package fine.remote.bridge;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

public final class Main {
  private static final String USAGE =
      "usage: fr-remote-bridge <list|read|write|delete|encrypt|encrypt-transmission>";

  private Main() {
  }

  public static void main(String[] args) {
    String operation = args.length > 0 ? args[0] : "unknown";
    if (args.length != 1 || !RequestData.isSupportedOperation(operation)) {
      System.err.println(JsonOutput.error(operation, USAGE));
      System.exit(64);
      return;
    }

    PrintStream originalOut = System.out;
    PrintStream originalErr = System.err;
    ByteArrayOutputStream captured = new ByteArrayOutputStream();

    try (PrintStream redirect = new PrintStream(captured)) {
      System.setOut(redirect);
      System.setErr(redirect);
      RequestData request = RequestData.fromStdIn(operation);
      String output = new FineRuntime(request).execute();
      System.setOut(originalOut);
      System.setErr(originalErr);
      originalOut.println(output);
    } catch (Exception exception) {
      System.setOut(originalOut);
      System.setErr(originalErr);
      originalErr.println(JsonOutput.error(operation, exception));
      System.exit(2);
    }
  }
}
