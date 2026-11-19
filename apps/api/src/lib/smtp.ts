import net from "node:net";
import tls from "node:tls";
import { readFile } from "node:fs/promises";
import path from "node:path";

type Mail = { to: string; subject: string; text: string };

function cleanHeader(value: string) { return value.replace(/[\r\n]+/g, " ").trim(); }

type SavedSmtp = { host?: string; port?: number; secure?: boolean; username?: string; password?: string; fromName?: string; fromEmail?: string };

async function smtpConfig() {
  let saved: SavedSmtp = {};
  try {
    const storePath = path.resolve(import.meta.dirname, "../../../admin/data/admin-store.json");
    const store = JSON.parse(await readFile(storePath, "utf8")) as { smtp?: SavedSmtp };
    saved = store.smtp ?? {};
  } catch { /* Environment variables remain the fallback for new installations. */ }
  const host = saved.host || process.env.SMTP_HOST || "127.0.0.1";
  const port = Number(saved.port || process.env.SMTP_PORT || 1025);
  const secure = saved.secure === true || process.env.SMTP_SECURE === "true" || port === 465;
  const username = saved.username || process.env.SMTP_USER || "";
  const password = saved.password || process.env.SMTP_PASSWORD || "";
  const fromName = saved.fromName || "Northstar Learning";
  const fromEmail = saved.fromEmail || "hello@northstar.test";
  const from = saved.fromEmail ? `${fromName} <${fromEmail}>` : process.env.SMTP_FROM || `${fromName} <${fromEmail}>`;
  return { host, port, secure, username, password, from };
}

export async function sendMail(mail: Mail) {
  const { host, port, secure, username, password, from } = await smtpConfig();
  const envelopeFrom = from.match(/<([^>]+)>/)?.[1] ?? from;
  const socket = secure ? tls.connect({ host, port, servername: host }) : net.createConnection({ host, port });
  socket.setEncoding("utf8");
  let buffer = "";

  const readResponse = () => new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(new Error("SMTP server response timed out."));
    }, 15_000);
    const onData = (chunk: string | Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\r\n");
      for (let index = 0; index < lines.length - 1; index += 1) {
        if (/^\d{3} /.test(lines[index]!)) {
          const response = lines.slice(0, index + 1).join("\r\n");
          buffer = lines.slice(index + 1).join("\r\n");
          cleanup(); resolve(response); return;
        }
      }
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("SMTP server closed the connection before replying.")); };
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
  const command = async (value: string, accepted: number[]) => {
    socket.write(`${value}\r\n`);
    const response = await readResponse();
    const code = Number(response.slice(0, 3));
    if (!accepted.includes(code)) throw new Error(`SMTP rejected a command with ${code}.`);
  };

  try {
    const greeting = await readResponse();
    if (Number(greeting.slice(0, 3)) !== 220) throw new Error("SMTP server did not accept the connection.");
    await command(`EHLO ${process.env.SMTP_HELO ?? "northstar.local"}`, [250]);
    if (username) {
      await command("AUTH LOGIN", [334]);
      await command(Buffer.from(username).toString("base64"), [334]);
      await command(Buffer.from(password).toString("base64"), [235]);
    }
    await command(`MAIL FROM:<${cleanHeader(envelopeFrom)}>`, [250]);
    await command(`RCPT TO:<${cleanHeader(mail.to)}>`, [250, 251]);
    await command("DATA", [354]);
    const body = [`From: ${cleanHeader(from)}`, `To: ${cleanHeader(mail.to)}`, `Subject: ${cleanHeader(mail.subject)}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", mail.text.replace(/^\./gm, ".."), ""].join("\r\n");
    await command(`${body}.`, [250]);
    await command("QUIT", [221]);
  } finally { socket.end(); }
}
