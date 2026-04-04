package fine.remote.bridge;

final class AuthorizationBuildConfig {
  private static final String AUTHORIZATION_FILE_NAME = "fr-remote-bridge.auth";
  private static final String PUBLIC_KEY_PEM = "";

  private AuthorizationBuildConfig() {
  }

  static String authorizationFileName() {
    return AUTHORIZATION_FILE_NAME;
  }

  static String publicKeyPem() {
    return PUBLIC_KEY_PEM;
  }
}
