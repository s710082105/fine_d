package fine.remote.bridge;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

final class AuthorizationGuard {
  interface MacAddressSource {
    List<String> resolveMacAddresses() throws AuthorizationException;
  }

  interface CurrentTimeSource {
    Instant currentTime();
  }

  private static final String MAC_KEY = "mac";
  private static final String EXPIRES_AT_KEY = "expires_at";
  private static final String SIGNATURE_KEY = "signature";
  private static final String MESSAGE_SUFFIX = "请联系管理员授权";

  private final MacAddressSource macAddressSource;
  private final CurrentTimeSource currentTimeSource;
  private final Path authorizationDirectory;
  private final String authorizationFileName;
  private final String publicKeyPem;

  AuthorizationGuard() throws AuthorizationException {
    this(
        MacAddressResolver::resolveMacAddresses,
        Instant::now,
        resolveAuthorizationDirectory(),
        AuthorizationBuildConfig.authorizationFileName(),
        AuthorizationBuildConfig.publicKeyPem()
    );
  }

  AuthorizationGuard(
      MacAddressSource macAddressSource,
      CurrentTimeSource currentTimeSource,
      Path authorizationDirectory,
      String authorizationFileName,
      String publicKeyPem
  ) {
    this.macAddressSource = macAddressSource;
    this.currentTimeSource = currentTimeSource;
    this.authorizationDirectory = authorizationDirectory;
    this.authorizationFileName = authorizationFileName;
    this.publicKeyPem = publicKeyPem;
  }

  void ensureAuthorized() throws AuthorizationException {
    List<String> macs = macAddressSource.resolveMacAddresses();
    Map<String, String> payload = loadPayload(macs);
    String licensedMac = requireNormalizedMac(payload, macs);
    String expiresAtText = requireValue(payload, EXPIRES_AT_KEY, macs);
    requireValidSignature(payload, licensedMac, expiresAtText, macs);
    if (!macs.contains(licensedMac)) {
      throw unauthorized(macs);
    }
    if (!currentTimeSource.currentTime().isBefore(parseInstant(expiresAtText, macs))) {
      throw unauthorized(macs);
    }
  }

  private Map<String, String> loadPayload(List<String> macs) throws AuthorizationException {
    Path authorizationFile = authorizationDirectory.resolve(authorizationFileName);
    try {
      String content = new String(Files.readAllBytes(authorizationFile), StandardCharsets.UTF_8);
      return RequestData.parseEncodedContent(content);
    } catch (Exception exception) {
      throw unauthorized(macs);
    }
  }

  private String requireNormalizedMac(Map<String, String> payload, List<String> macs) throws AuthorizationException {
    String value = requireValue(payload, MAC_KEY, macs);
    return normalizeMac(value, macs);
  }

  private String requireValue(Map<String, String> payload, String key, List<String> macs) throws AuthorizationException {
    String value = payload.get(key);
    if (value == null || value.isEmpty()) {
      throw unauthorized(macs);
    }
    return value;
  }

  private void requireValidSignature(
      Map<String, String> payload,
      String licensedMac,
      String expiresAtText,
      List<String> macs
  ) throws AuthorizationException {
    String signatureText = requireValue(payload, SIGNATURE_KEY, macs);
    try {
      PublicKey publicKey = loadPublicKey(publicKeyPem);
      Signature verifier = Signature.getInstance("SHA256withRSA");
      verifier.initVerify(publicKey);
      verifier.update(canonicalPayload(licensedMac, expiresAtText).getBytes(StandardCharsets.UTF_8));
      byte[] signature = Base64.getDecoder().decode(signatureText);
      if (!verifier.verify(signature)) {
        throw unauthorized(macs);
      }
    } catch (AuthorizationException exception) {
      throw exception;
    } catch (Exception exception) {
      throw unauthorized(macs);
    }
  }

  private static PublicKey loadPublicKey(String pem) throws Exception {
    String normalized = pem
        .replace("-----BEGIN PUBLIC KEY-----", "")
        .replace("-----END PUBLIC KEY-----", "")
        .replaceAll("\\s+", "");
    byte[] decoded = Base64.getDecoder().decode(normalized);
    return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decoded));
  }

  private static Instant parseInstant(String value, List<String> macs) throws AuthorizationException {
    try {
      return Instant.parse(value);
    } catch (Exception exception) {
      throw unauthorized(macs);
    }
  }

  private static String normalizeMac(String rawMac, List<String> macs) throws AuthorizationException {
    String normalized = rawMac.replaceAll("[^0-9A-Fa-f]", "").toUpperCase();
    if (normalized.length() != 12) {
      throw unauthorized(macs);
    }
    StringBuilder builder = new StringBuilder();
    for (int index = 0; index < normalized.length(); index += 2) {
      if (index > 0) {
        builder.append(':');
      }
      builder.append(normalized, index, index + 2);
    }
    return builder.toString();
  }

  private static String canonicalPayload(String mac, String expiresAt) {
    return MAC_KEY + "=" + mac + "\n" + EXPIRES_AT_KEY + "=" + expiresAt + "\n";
  }

  private static AuthorizationException unauthorized(List<String> macs) {
    return new AuthorizationException(buildUnauthorizedMessage(macs));
  }

  private static String buildUnauthorizedMessage(List<String> macs) {
    return "设备 MAC: " + String.join(", ", macs) + "，" + MESSAGE_SUFFIX;
  }

  private static Path resolveAuthorizationDirectory() throws AuthorizationException {
    try {
      URI location = Main.class.getProtectionDomain().getCodeSource().getLocation().toURI();
      Path path = Paths.get(location);
      return Files.isDirectory(path) ? path : path.getParent();
    } catch (Exception exception) {
      throw new AuthorizationException("设备 MAC: UNKNOWN，" + MESSAGE_SUFFIX);
    }
  }
}
