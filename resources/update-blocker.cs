using System;
using System.Reflection;

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
            // Immediate exit 0 prevents Roblox's background update thread from downloading and replacing downgraded versions
            return 0;
        }
    }
}
