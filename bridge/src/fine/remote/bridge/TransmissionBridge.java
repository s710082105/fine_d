package fine.remote.bridge;

import java.net.URLClassLoader;
import java.util.LinkedHashMap;
import java.util.Map;

final class TransmissionBridge {
  private static final String AES_TRANSMISSION_MODE = "2";
  private static final String SM4_TRANSMISSION_MODE = "3";
  private static final String TRANSMISSION_TOOL_CLASS = "com.fr.decision.privilege.TransmissionTool";
  private static final String AES_TOOL_CLASS = "com.fr.security.encryption.core.EncryptionToolBox$AES";
  private static final String SM4_TOOL_CLASS = "com.fr.security.encryption.core.EncryptionToolBox$SM4";

  private TransmissionBridge() {
  }

  static Map<String, Object> encrypt(RequestData request) throws Exception {
    try (URLClassLoader loader = FineLoader.create(request.fineHome())) {
      Thread.currentThread().setContextClassLoader(loader);
      Class<?> transmissionTool = loader.loadClass(TRANSMISSION_TOOL_CLASS);
      String encrypted = String.valueOf(
          ReflectionSupport.invokeStatic(
              transmissionTool,
              "encrypt",
              new Class<?>[]{String.class},
              request.text()
          )
      );
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("text", encrypted);
      return payload;
    }
  }

  static Map<String, Object> encryptTransmission(RequestData request) throws Exception {
    try (URLClassLoader loader = FineLoader.create(request.fineHome())) {
      Thread.currentThread().setContextClassLoader(loader);
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("text", encryptTransmission(loader, request));
      return payload;
    }
  }

  private static String encryptTransmission(URLClassLoader loader, RequestData request) throws Exception {
    String mode = request.transmissionEncryption();
    if (AES_TRANSMISSION_MODE.equals(mode)) {
      return invokeTransmissionEncrypt(loader, AES_TOOL_CLASS, request.text(), request.frontSeed());
    }
    if (SM4_TRANSMISSION_MODE.equals(mode)) {
      return invokeTransmissionEncrypt(loader, SM4_TOOL_CLASS, request.text(), request.frontSm4Key());
    }
    throw new IllegalArgumentException("unsupported transmissionEncryption: " + mode);
  }

  private static String invokeTransmissionEncrypt(
      URLClassLoader loader,
      String className,
      String text,
      String key
  ) throws Exception {
    Class<?> encryptionTool = loader.loadClass(className);
    Object value = ReflectionSupport.invokeStatic(
        encryptionTool,
        "encrypt",
        new Class<?>[]{String.class, String.class},
        text,
        key
    );
    return String.valueOf(value);
  }
}
