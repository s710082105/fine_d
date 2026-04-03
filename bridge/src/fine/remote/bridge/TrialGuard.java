package fine.remote.bridge;

import java.time.Instant;

final class TrialGuard {
  interface CurrentTimeSource {
    Instant fetchCurrentTime() throws TrialExpiredException;
  }

  static final String EXPIRED_MESSAGE = "试用过期，请获取正式版";

  private final CurrentTimeSource currentTimeSource;
  private final Instant expiresAt;

  TrialGuard() {
    this(new NtpTimeClient(TrialBuildConfig.ntpServers(), TrialBuildConfig.ntpTimeoutMillis()), TrialBuildConfig.expiresAt());
  }

  TrialGuard(CurrentTimeSource currentTimeSource, Instant expiresAt) {
    this.currentTimeSource = currentTimeSource;
    this.expiresAt = expiresAt;
  }

  void ensureValid() throws TrialExpiredException {
    Instant current = currentTimeSource.fetchCurrentTime();
    if (!current.isBefore(expiresAt)) {
      throw new TrialExpiredException(EXPIRED_MESSAGE);
    }
  }
}
