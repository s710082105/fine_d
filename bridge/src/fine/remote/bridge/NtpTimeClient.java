package fine.remote.bridge;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.time.Instant;

final class NtpTimeClient implements TrialGuard.CurrentTimeSource {
  private static final int REQUEST_SIZE = 48;
  private static final int DEFAULT_PORT = 123;
  private static final long NTP_TO_UNIX_EPOCH_SECONDS = 2208988800L;

  private final String[] servers;
  private final int timeoutMillis;

  NtpTimeClient(String[] servers, int timeoutMillis) {
    this.servers = servers.clone();
    this.timeoutMillis = timeoutMillis;
  }

  public Instant fetchCurrentTime() throws TrialExpiredException {
    for (String server : servers) {
      Instant current = tryServer(server);
      if (current != null) {
        return current;
      }
    }
    throw new TrialExpiredException(TrialGuard.EXPIRED_MESSAGE);
  }

  private Instant tryServer(String server) {
    HostPort target = HostPort.parse(server);
    try (DatagramSocket socket = new DatagramSocket()) {
      socket.setSoTimeout(timeoutMillis);
      socket.send(requestPacket(target));
      return readResponse(socket);
    } catch (IOException | RuntimeException exception) {
      return null;
    }
  }

  private DatagramPacket requestPacket(HostPort target) throws IOException {
    byte[] request = new byte[REQUEST_SIZE];
    request[0] = 0x1B;
    InetAddress address = InetAddress.getByName(target.host());
    return new DatagramPacket(request, request.length, address, target.port());
  }

  private Instant readResponse(DatagramSocket socket) throws IOException {
    byte[] response = new byte[REQUEST_SIZE];
    DatagramPacket packet = new DatagramPacket(response, response.length);
    socket.receive(packet);
    if (packet.getLength() < REQUEST_SIZE) {
      return null;
    }
    long seconds = unsignedInt(response, 40) - NTP_TO_UNIX_EPOCH_SECONDS;
    long fraction = unsignedInt(response, 44);
    long nanos = (fraction * 1_000_000_000L) >>> 32;
    return Instant.ofEpochSecond(seconds, nanos);
  }

  private long unsignedInt(byte[] data, int offset) {
    long value = 0L;
    for (int index = 0; index < 4; index += 1) {
      value = (value << 8) | (data[offset + index] & 0xFFL);
    }
    return value;
  }

  private static final class HostPort {
    private final String host;
    private final int port;

    private HostPort(String host, int port) {
      this.host = host;
      this.port = port;
    }

    static HostPort parse(String value) {
      int separator = value.lastIndexOf(':');
      if (separator > 0 && separator == value.indexOf(':') && separator < value.length() - 1) {
        return new HostPort(value.substring(0, separator), Integer.parseInt(value.substring(separator + 1)));
      }
      return new HostPort(value, DEFAULT_PORT);
    }

    String host() {
      return host;
    }

    int port() {
      return port;
    }
  }
}
