using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace CoffeeDesk
{
    class Program
    {
        [DllImport("user32.dll")]
        static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        static extern int GetSystemMetrics(int nIndex);

        [StructLayout(LayoutKind.Sequential)]
        struct INPUT
        {
            public uint type;
            public MOUSEKEYBDHARDWAREINPUT mkhi;
        }

        [StructLayout(LayoutKind.Explicit)]
        struct MOUSEKEYBDHARDWAREINPUT
        {
            [FieldOffset(0)]
            public MOUSEINPUT mi;
            [FieldOffset(0)]
            public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [DllImport("user32.dll", SetLastError = true)]
        static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        const int INPUT_KEYBOARD = 1;
        const uint KEYEVENTF_KEYUP = 0x0002;
        const uint KEYEVENTF_UNICODE = 0x0004;

        const int SM_CXSCREEN = 0;
        const int SM_CYSCREEN = 1;

        const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        const uint MOUSEEVENTF_LEFTUP = 0x0004;
        const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        const uint MOUSEEVENTF_WHEEL = 0x0800;

        static void SendUnicodeString(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            foreach (char c in text)
            {
                INPUT[] inputs = new INPUT[2];

                // Key down
                inputs[0].type = INPUT_KEYBOARD;
                inputs[0].mkhi.ki.wVk = 0;
                inputs[0].mkhi.ki.wScan = (ushort)c;
                inputs[0].mkhi.ki.dwFlags = KEYEVENTF_UNICODE;
                inputs[0].mkhi.ki.time = 0;
                inputs[0].mkhi.ki.dwExtraInfo = IntPtr.Zero;

                // Key up
                inputs[1].type = INPUT_KEYBOARD;
                inputs[1].mkhi.ki.wVk = 0;
                inputs[1].mkhi.ki.wScan = (ushort)c;
                inputs[1].mkhi.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
                inputs[1].mkhi.ki.time = 0;
                inputs[1].mkhi.ki.dwExtraInfo = IntPtr.Zero;

                SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
            }
        }

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine("READY");
            Console.Out.Flush();

            string line;
            while ((line = Console.ReadLine()) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                if (line == "PING") { Console.WriteLine("PONG"); Console.Out.Flush(); continue; }
                if (line == "EXIT") break;

                try
                {
                    string[] parts = line.Split(' ');
                    string cmd = parts[0];

                    switch (cmd)
                    {
                        // M x y (pixels absolutos)
                        case "M":
                            if (parts.Length >= 3)
                            {
                                int x = int.Parse(parts[1], CultureInfo.InvariantCulture);
                                int y = int.Parse(parts[2], CultureInfo.InvariantCulture);
                                SetCursorPos(x, y);
                            }
                            break;

                        // MN normX normY (normalizado de 0.0 a 1.0)
                        case "MN":
                            if (parts.Length >= 3)
                            {
                                double nx = double.Parse(parts[1], CultureInfo.InvariantCulture);
                                double ny = double.Parse(parts[2], CultureInfo.InvariantCulture);
                                int screenW = GetSystemMetrics(SM_CXSCREEN);
                                int screenH = GetSystemMetrics(SM_CYSCREEN);
                                int px = (int)Math.Round(nx * screenW);
                                int py = (int)Math.Round(ny * screenH);
                                SetCursorPos(px, py);
                            }
                            break;

                        // D button (mouse down: left, right, middle)
                        case "D":
                            if (parts.Length >= 2)
                            {
                                string btn = parts[1].ToLowerInvariant();
                                if (btn == "left") mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                                else if (btn == "right") mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                                else if (btn == "middle") mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, UIntPtr.Zero);
                            }
                            break;

                        // U button (mouse up: left, right, middle)
                        case "U":
                            if (parts.Length >= 2)
                            {
                                string btn = parts[1].ToLowerInvariant();
                                if (btn == "left") mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                                else if (btn == "right") mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                                else if (btn == "middle") mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, UIntPtr.Zero);
                            }
                            break;

                        // C button (clique = down + up)
                        case "C":
                            if (parts.Length >= 2)
                            {
                                string btn = parts[1].ToLowerInvariant();
                                if (btn == "left")
                                {
                                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                                }
                                else if (btn == "right")
                                {
                                    mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                                    mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                                }
                                else if (btn == "middle")
                                {
                                    mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, UIntPtr.Zero);
                                    mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, UIntPtr.Zero);
                                }
                            }
                            break;

                        // DC button (duplo clique)
                        case "DC":
                            {
                                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                                Thread.Sleep(40);
                                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                            }
                            break;

                        // W deltaY (scroll wheel)
                        case "W":
                            if (parts.Length >= 2)
                            {
                                int dy = int.Parse(parts[1], CultureInfo.InvariantCulture);
                                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)dy, UIntPtr.Zero);
                            }
                            break;

                        // KD vkCode (key down)
                        case "KD":
                            if (parts.Length >= 2)
                            {
                                byte vk = (byte)int.Parse(parts[1], CultureInfo.InvariantCulture);
                                keybd_event(vk, 0, 0, UIntPtr.Zero);
                            }
                            break;

                        // KU vkCode (key up)
                        case "KU":
                            if (parts.Length >= 2)
                            {
                                byte vk = (byte)int.Parse(parts[1], CultureInfo.InvariantCulture);
                                keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                            }
                            break;

                        // KT vkCode (key tap = down + up)
                        case "KT":
                            if (parts.Length >= 2)
                            {
                                byte vk = (byte)int.Parse(parts[1], CultureInfo.InvariantCulture);
                                keybd_event(vk, 0, 0, UIntPtr.Zero);
                                keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                            }
                            break;

                        // TX base64text (Unicode text typing)
                        case "TX":
                            if (parts.Length >= 2)
                            {
                                byte[] bytes = Convert.FromBase64String(parts[1]);
                                string text = Encoding.UTF8.GetString(bytes);
                                SendUnicodeString(text);
                            }
                            break;
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("ERR: " + ex.Message);
                }
            }
        }
    }
}
