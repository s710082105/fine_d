package fine.remote.bridge;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

final class ReflectionSupport {
  private ReflectionSupport() {
  }

  static Object invokeStatic(Class<?> type, String methodName) throws Exception {
    return invokeStatic(type, methodName, new Class<?>[0]);
  }

  static Object invokeStatic(
      Class<?> type,
      String methodName,
      Class<?>[] parameterTypes,
      Object... arguments
  ) throws Exception {
    Method method = type.getMethod(methodName, parameterTypes);
    return method.invoke(null, arguments);
  }

  static Object invoke(Object target, String methodName) throws Exception {
    return invoke(target, methodName, new Class<?>[0]);
  }

  static Object invoke(
      Object target,
      String methodName,
      Class<?>[] parameterTypes,
      Object... arguments
  ) throws Exception {
    Method method = target.getClass().getMethod(methodName, parameterTypes);
    return method.invoke(target, arguments);
  }

  static Object newInstance(Class<?> type, Class<?>[] parameterTypes, Object... arguments)
      throws Exception {
    Constructor<?> constructor = type.getConstructor(parameterTypes);
    return constructor.newInstance(arguments);
  }

  static boolean invokeBoolean(Object target, String methodName) throws Exception {
    return ((Boolean) invoke(target, methodName)).booleanValue();
  }

  static String invokeString(Object target, String methodName) throws Exception {
    Object value = invoke(target, methodName);
    if (value == null) {
      return null;
    }
    return new String(String.valueOf(value).getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
  }
}
