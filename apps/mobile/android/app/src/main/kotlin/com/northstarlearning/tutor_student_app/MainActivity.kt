package com.northstarlearning.tutor_student_app

import android.app.DownloadManager
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Environment
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var pendingVideoResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "northstar/native").setMethodCallHandler { call, result ->
            val preferences = getSharedPreferences("northstar_student", MODE_PRIVATE)
            when (call.method) {
                "readToken" -> result.success(preferences.getString("session_token", null))
                "saveToken" -> {
                    val token = call.arguments as? String
                    if (token.isNullOrBlank()) result.error("INVALID_TOKEN", "A session token is required.", null)
                    else { preferences.edit().putString("session_token", token).apply(); result.success(null) }
                }
                "clearToken" -> { preferences.edit().remove("session_token").apply(); result.success(null) }
                "openUrl" -> {
                    val value = call.arguments as? String
                    val uri = value?.let(Uri::parse)
                    if (uri == null || (uri.scheme != "https" && uri.scheme != "http")) result.error("INVALID_URL", "Only web video links are supported.", null)
                    else try { startActivity(Intent(Intent.ACTION_VIEW, uri)); result.success(null) } catch (_: Exception) { result.error("NO_HANDLER", "No app can open this video.", null) }
                }
                "playVideo" -> {
                    val arguments = call.arguments as? Map<*, *>
                    val url = arguments?.get("url") as? String
                    val uri = url?.let(Uri::parse)
                    if (uri == null || (uri.scheme != "https" && uri.scheme != "http")) result.error("INVALID_URL", "Only web video links are supported.", null)
                    else if (pendingVideoResult != null) result.error("PLAYER_BUSY", "A video is already open.", null)
                    else try {
                        pendingVideoResult = result
                        startActivityForResult(Intent(this, VideoPlayerActivity::class.java).apply {
                            putExtra("url", url)
                            putExtra("provider", arguments["provider"] as? String ?: "Video")
                            putExtra("title", arguments["title"] as? String ?: "Course video")
                            putExtra("videoId", arguments["videoId"] as? String ?: "")
                            putExtra("startSeconds", (arguments["startSeconds"] as? Number)?.toInt() ?: 0)
                            putExtra("reportUrl", arguments["reportUrl"] as? String ?: "")
                            putExtra("progressUrl", arguments["progressUrl"] as? String ?: "")
                            putExtra("sessionToken", preferences.getString("session_token", ""))
                        }, VIDEO_REQUEST_CODE)
                    } catch (_: Exception) {
                        pendingVideoResult = null
                        result.error("PLAYER_ERROR", "Could not open the in-app player.", null)
                    }
                }
                "downloadFile" -> {
                    val arguments = call.arguments as? Map<*, *>
                    val url = arguments?.get("url") as? String
                    val uri = url?.let(Uri::parse)
                    val rawName = arguments?.get("name") as? String ?: "course-resource"
                    val safeName = rawName.replace(Regex("[^a-zA-Z0-9._ -]"), "_")
                    if (uri == null || (uri.scheme != "https" && uri.scheme != "http")) result.error("INVALID_URL", "Only web downloads are supported.", null)
                    else try {
                        val request = DownloadManager.Request(uri)
                            .setTitle(safeName)
                            .setDescription("Course attachment")
                            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeName)
                        (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                        result.success(null)
                    } catch (_: Exception) { result.error("DOWNLOAD_ERROR", "Could not start the download.", null) }
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != VIDEO_REQUEST_CODE) return
        pendingVideoResult?.success(mapOf(
            "positionSeconds" to (data?.getIntExtra("positionSeconds", 0) ?: 0),
            "durationSeconds" to (data?.getIntExtra("durationSeconds", 0) ?: 0),
            "completed" to (data?.getBooleanExtra("completed", false) ?: false),
            "closed" to (resultCode == Activity.RESULT_OK),
        ))
        pendingVideoResult = null
    }

    companion object {
        private const val VIDEO_REQUEST_CODE = 9041
    }
}
