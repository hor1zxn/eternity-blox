using System;
using System.Reflection;
using System.Threading;

[assembly: AssemblyTitle("Roblox Player Installer")]
[assembly: AssemblyDescription("Roblox Player Installer Stub")]
[assembly: AssemblyCompany("Roblox Corporation")]
[assembly: AssemblyProduct("Roblox")]
[assembly: AssemblyCopyright("Copyright © Roblox Corporation")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace RobloxPlayerInstaller
{
    internal static class Program
    {
        private static int Main(string[] args)
        {
            // Roblox's UpdateController spawns this process and waits for it to exit.
            // If it exits with code 0, Roblox treats it as "update installed" and
            // terminates itself to restart on the new version -- killing the downgraded session.
            //
            // By sleeping indefinitely, the UpdateController thread blocks forever,
            // the game continues running on the downgraded version, and no restart occurs.
            // When the parent Roblox process eventually exits (user closes the game),
            // this orphaned process is cleaned up by the OS.
            Thread.Sleep(Timeout.Infinite);
            return 0;
        }
    }
}
