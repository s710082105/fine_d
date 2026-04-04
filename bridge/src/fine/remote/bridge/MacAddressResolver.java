package fine.remote.bridge;

import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class MacAddressResolver {
  private MacAddressResolver() {
  }

  static List<String> resolveMacAddresses() throws AuthorizationException {
    try {
      Set<String> macs = new LinkedHashSet<>();
      Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
      if (interfaces == null) {
        return Collections.singletonList("UNKNOWN");
      }
      while (interfaces.hasMoreElements()) {
        collectMacAddress(macs, interfaces.nextElement());
      }
      if (macs.isEmpty()) {
        return Collections.singletonList("UNKNOWN");
      }
      return new ArrayList<>(macs);
    } catch (Exception exception) {
      throw new AuthorizationException("设备 MAC: UNKNOWN，请联系管理员授权");
    }
  }

  private static void collectMacAddress(Set<String> macs, NetworkInterface network) throws Exception {
    if (!network.isUp() || network.isLoopback() || network.isVirtual()) {
      return;
    }
    byte[] hardwareAddress = network.getHardwareAddress();
    if (hardwareAddress == null || hardwareAddress.length != 6) {
      return;
    }
    macs.add(formatMac(hardwareAddress));
  }

  private static String formatMac(byte[] hardwareAddress) {
    StringBuilder builder = new StringBuilder();
    for (int index = 0; index < hardwareAddress.length; index += 1) {
      if (index > 0) {
        builder.append(':');
      }
      builder.append(String.format("%02X", Integer.valueOf(hardwareAddress[index] & 0xFF)));
    }
    return builder.toString();
  }
}
