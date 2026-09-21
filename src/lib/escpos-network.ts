import net from 'net';

export interface NetworkPrintOptions {
  host: string;
  port?: number;
  timeoutMs?: number;
}

/**
 * Send raw ESC/POS binary buffer directly to a network/LAN/Wi-Fi thermal printer
 * via TCP port (typically port 9100 for raw jetdirect/escpos)
 */
export async function sendEscPosToNetworkPrinter(
  buffer: Buffer,
  options: NetworkPrintOptions
): Promise<{ success: boolean; message: string; bytesSent?: number }> {
  const { host, port = 9100, timeoutMs = 4000 } = options;

  if (!host || host.trim().length === 0) {
    throw new Error('Printer IP address is required');
  }

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let isFinished = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      socket.write(buffer, (err) => {
        if (err) {
          isFinished = true;
          socket.destroy();
          reject(new Error(`Failed to write to printer: ${err.message}`));
          return;
        }

        // Allow printer to flush buffer
        setTimeout(() => {
          if (!isFinished) {
            isFinished = true;
            socket.end();
            resolve({
              success: true,
              message: `Printed successfully to ${host}:${port}`,
              bytesSent: buffer.length,
            });
          }
        }, 200);
      });
    });

    socket.on('timeout', () => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        reject(new Error(`Connection to printer at ${host}:${port} timed out (${timeoutMs}ms)`));
      }
    });

    socket.on('error', (err: any) => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        if (err.code === 'ECONNREFUSED') {
          reject(new Error(`Printer at ${host}:${port} refused connection. Ensure printer is ON and connected to network.`));
        } else if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH') {
          reject(new Error(`Printer IP ${host} unreachable on local network.`));
        } else {
          reject(new Error(`Printer network error: ${err.message}`));
        }
      }
    });
  });
}
