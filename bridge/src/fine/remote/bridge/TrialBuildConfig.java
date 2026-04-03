package fine.remote.bridge;

import java.time.Instant;

final class TrialBuildConfig {
  private static final String EXPIRES_AT = "2099-12-31T23:59:59Z";
  private static final String[] NTP_SERVERS = new String[]{"time.cloudflare.com"};
  private static final int NTP_TIMEOUT_MILLIS = 1000;

  private TrialBuildConfig() {
  }

  static Instant expiresAt() {
    return Instant.parse(EXPIRES_AT);
  }

  static String[] ntpServers() {
    return NTP_SERVERS.clone();
  }

  static int ntpTimeoutMillis() {
    return NTP_TIMEOUT_MILLIS;
  }
}
