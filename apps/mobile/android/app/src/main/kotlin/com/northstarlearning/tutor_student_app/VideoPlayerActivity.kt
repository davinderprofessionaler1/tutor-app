package com.northstarlearning.tutor_student_app

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.TextUtils
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.function.Consumer

class VideoPlayerActivity : Activity() {
    private lateinit var webView: WebView
    private val reportedCaptureTypes = mutableSetOf<String>()
    private var screenCaptureCallback: ScreenCaptureCallback? = null
    private var screenRecordingCallback: Consumer<Int>? = null
    private var restrictionDialog: AlertDialog? = null
    private var positionSeconds = 0.0
    private var durationSeconds = 0.0
    private var completed = false
    private var lastReportedSecond = -1
    private var resultSent = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.BLACK
        if (Build.VERSION.SDK_INT < 35) {
            window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        }

        val url = intent.getStringExtra("url").orEmpty()
        val provider = intent.getStringExtra("provider").orEmpty()
        val title = intent.getStringExtra("title") ?: "Course video"
        positionSeconds = intent.getIntExtra("startSeconds", 0).toDouble()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
        }
        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(8, 8, 16, 8)
            setBackgroundColor(Color.rgb(10, 18, 22))
        }
        toolbar.addView(ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_media_previous)
            contentDescription = "Back"
            setColorFilter(Color.WHITE)
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(56, 56))
        toolbar.addView(TextView(this).apply {
            text = title
            setTextColor(Color.WHITE)
            textSize = 16f
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = WebChromeClient()
            webViewClient = WebViewClient()
            addJavascriptInterface(ProgressBridge(), "ProgressBridge")
        }
        root.addView(toolbar)
        root.addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
        webView.loadDataWithBaseURL("https://localhost/", playerHtml(url, provider, positionSeconds.toInt()), "text/html", "UTF-8", null)
    }

    override fun onStart() {
        super.onStart()
        if (Build.VERSION.SDK_INT >= 35) {
            if (screenCaptureCallback == null) {
                screenCaptureCallback = ScreenCaptureCallback { handleCapture("screenshot") }
                registerScreenCaptureCallback(mainExecutor, screenCaptureCallback!!)
            }
            if (screenRecordingCallback == null) {
                val manager = getSystemService(WindowManager::class.java)
                screenRecordingCallback = Consumer { state ->
                    if (state == WindowManager.SCREEN_RECORDING_STATE_VISIBLE) handleCapture("screen_recording")
                }
                val currentState = manager.addScreenRecordingCallback(mainExecutor, screenRecordingCallback!!)
                if (currentState == WindowManager.SCREEN_RECORDING_STATE_VISIBLE) handleCapture("screen_recording")
            }
        }
    }

    override fun onStop() {
        reportProgress(force = true)
        if (Build.VERSION.SDK_INT >= 35) {
            screenCaptureCallback?.let {
                unregisterScreenCaptureCallback(it)
                screenCaptureCallback = null
            }
            screenRecordingCallback?.let {
                getSystemService(WindowManager::class.java).removeScreenRecordingCallback(it)
                screenRecordingCallback = null
            }
        }
        super.onStop()
    }

    inner class ProgressBridge {
        @JavascriptInterface
        fun update(position: Double, duration: Double, ended: Boolean) {
            if (position.isFinite() && position >= 0) positionSeconds = position
            if (duration.isFinite() && duration > 0) durationSeconds = duration
            completed = completed || ended || (durationSeconds > 0 && positionSeconds >= durationSeconds - 5)
            reportProgress(force = completed)
        }
    }

    private fun handleCapture(eventType: String) {
        if (!reportedCaptureTypes.add(eventType)) return
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        if (::webView.isInitialized) {
            val stopPlaybackScript = """(function(){document.querySelectorAll('video').forEach(function(v){v.pause();});document.querySelectorAll('iframe').forEach(function(f){f.src='about:blank';});document.body.innerHTML='<div class="error">Playback stopped because screen capture is restricted.</div>';})();"""
            webView.evaluateJavascript(stopPlaybackScript, null)
            webView.onPause()
        }
        reportSecurityEvent(eventType)
        if (!isFinishing && restrictionDialog?.isShowing != true) {
            restrictionDialog = AlertDialog.Builder(this)
                .setTitle("Screen capture is restricted")
                .setMessage(if (eventType == "screenshot") "A screenshot was detected. Video playback has been stopped and the administrator has been notified." else "Screen recording was detected. Video playback has been stopped and the administrator has been notified.")
                .setCancelable(false)
                .setPositiveButton("Close video") { _, _ -> finish() }
                .show()
        }
    }

    private fun reportSecurityEvent(eventType: String) {
        val reportUrl = intent.getStringExtra("reportUrl").orEmpty()
        val token = intent.getStringExtra("sessionToken").orEmpty()
        val videoTitle = intent.getStringExtra("title") ?: "Course video"
        if (reportUrl.isBlank() || token.isBlank()) return
        Thread {
            var connection: HttpURLConnection? = null
            try {
                connection = URL(reportUrl).openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.connectTimeout = 8_000
                connection.readTimeout = 8_000
                connection.doOutput = true
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json")
                val payload = JSONObject().put("eventType", eventType).put("videoTitle", videoTitle).toString()
                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                connection.responseCode
            } catch (_: Exception) {
                // Capture protection remains active even if the alert cannot reach the server.
            } finally {
                connection?.disconnect()
            }
        }.start()
    }

    @Synchronized
    private fun reportProgress(force: Boolean = false) {
        val progressUrl = intent.getStringExtra("progressUrl").orEmpty()
        val token = intent.getStringExtra("sessionToken").orEmpty()
        val videoId = intent.getStringExtra("videoId").orEmpty()
        val position = positionSeconds.toInt().coerceAtLeast(0)
        val duration = durationSeconds.toInt().coerceAtLeast(0)
        val reportedAt = System.currentTimeMillis()
        if (progressUrl.isBlank() || token.isBlank() || videoId.isBlank()) return
        if (!force && lastReportedSecond >= 0 && kotlin.math.abs(position - lastReportedSecond) < 10) return
        lastReportedSecond = position
        Thread {
            var connection: HttpURLConnection? = null
            try {
                connection = URL(progressUrl).openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.connectTimeout = 8_000
                connection.readTimeout = 8_000
                connection.doOutput = true
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json")
                val payload = JSONObject()
                    .put("videoId", videoId)
                    .put("positionSeconds", position)
                    .put("durationSeconds", duration)
                    .put("completed", completed)
                    .put("reportedAt", reportedAt)
                    .toString()
                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                connection.responseCode
            } catch (_: Exception) {
                // A later player update or exit will retry progress reporting.
            } finally {
                connection?.disconnect()
            }
        }.start()
    }

    private fun playerHtml(url: String, provider: String, startSeconds: Int): String {
        val lowerProvider = provider.lowercase()
        val safeStart = startSeconds.coerceAtLeast(0)
        val content = when {
            lowerProvider.contains("youtube") || url.contains("youtu") -> {
                val id = youtubeId(url)
                if (id.isBlank()) errorMessage("Invalid YouTube URL") else {
                    val safeId = Uri.encode(id)
                    """<div id="player"></div><script src="https://www.youtube.com/iframe_api"></script><script>
                    var player;
                    function sendProgress(done){if(player&&player.getCurrentTime&&window.ProgressBridge){ProgressBridge.update(player.getCurrentTime()||0,player.getDuration()||0,!!done);}}
                    function onYouTubeIframeAPIReady(){player=new YT.Player('player',{videoId:'$safeId',playerVars:{autoplay:1,playsinline:1,start:$safeStart},events:{onReady:function(e){if($safeStart>0)e.target.seekTo($safeStart,true);e.target.playVideo();setInterval(function(){sendProgress(false);},5000);},onStateChange:function(e){if(e.data===YT.PlayerState.ENDED)sendProgress(true);}}});}
                    </script>"""
                }
            }
            lowerProvider.contains("vimeo") || url.contains("vimeo.com") -> {
                val id = Uri.parse(url).pathSegments.lastOrNull { it.all(Char::isDigit) }.orEmpty()
                if (id.isBlank()) errorMessage("Invalid Vimeo URL") else {
                    val safeId = Uri.encode(id)
                    """<iframe id="player" src="https://player.vimeo.com/video/$safeId?autoplay=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe><script src="https://player.vimeo.com/api/player.js"></script><script>
                    var player=new Vimeo.Player(document.getElementById('player')),lastReported=0;
                    player.ready().then(function(){if($safeStart>0)player.setCurrentTime($safeStart);player.play();});
                    player.on('timeupdate',function(data){if(Math.abs(data.seconds-lastReported)>=5){lastReported=data.seconds;if(window.ProgressBridge)ProgressBridge.update(data.seconds,data.duration,false);}});
                    player.on('pause',function(data){if(window.ProgressBridge)ProgressBridge.update(data.seconds,data.duration,false);});
                    player.on('ended',function(data){if(window.ProgressBridge)ProgressBridge.update(data.seconds,data.duration,true);});
                    </script>"""
                }
            }
            else -> {
                val safeUrl = TextUtils.htmlEncode(url)
                """<video id="player" controls autoplay playsinline src="$safeUrl"></video><script>
                var player=document.getElementById('player'),lastReported=0;
                player.addEventListener('loadedmetadata',function(){if($safeStart>0)player.currentTime=$safeStart;player.play();});
                player.addEventListener('timeupdate',function(){if(Math.abs(player.currentTime-lastReported)>=5){lastReported=player.currentTime;if(window.ProgressBridge)ProgressBridge.update(player.currentTime,player.duration||0,false);}});
                player.addEventListener('pause',function(){if(window.ProgressBridge)ProgressBridge.update(player.currentTime,player.duration||0,false);});
                player.addEventListener('ended',function(){if(window.ProgressBridge)ProgressBridge.update(player.currentTime,player.duration||0,true);});
                </script>"""
            }
        }
        return """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}body{display:flex;align-items:center;justify-content:center}iframe,video{border:0;width:100%;height:100%;max-height:100vh;color:#fff}.error{color:#fff;font:16px sans-serif}</style></head><body>$content</body></html>"""
    }
    private fun errorMessage(message: String) = "<div class=\"error\">${TextUtils.htmlEncode(message)}</div>"

    private fun youtubeId(value: String): String {
        val uri = Uri.parse(value)
        uri.getQueryParameter("v")?.takeIf { it.isNotBlank() }?.let { return it }
        val segments = uri.pathSegments
        if (uri.host?.contains("youtu.be") == true) return segments.firstOrNull().orEmpty()
        val marker = segments.indexOfFirst { it == "embed" || it == "shorts" || it == "live" }
        return if (marker >= 0) segments.getOrNull(marker + 1).orEmpty() else ""
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun finish() {
        reportProgress(force = true)
        if (!resultSent) {
            resultSent = true
            setResult(RESULT_OK, Intent().apply {
                putExtra("positionSeconds", positionSeconds.toInt().coerceAtLeast(0))
                putExtra("durationSeconds", durationSeconds.toInt().coerceAtLeast(0))
                putExtra("completed", completed)
            })
        }
        super.finish()
    }

    override fun onDestroy() {
        reportProgress(force = true)
        restrictionDialog?.dismiss()
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}
