using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
namespace CoffeeDesk {
 internal static class VirtualMouse {
  [StructLayout(LayoutKind.Sequential)]struct POINT {public int X,Y;public POINT(int x,int y){X=x;Y=y;}}
  [StructLayout(LayoutKind.Sequential)]struct RECT {public int Left,Top,Right,Bottom;}
  [DllImport("user32.dll")]static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")]static extern bool ScreenToClient(IntPtr window,ref POINT p);
  [DllImport("user32.dll")]static extern IntPtr GetAncestor(IntPtr window,uint flags);
  [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")]static extern bool PostMessage(IntPtr window,uint message,IntPtr wp,IntPtr lp);
  [DllImport("user32.dll")]static extern IntPtr SendMessageTimeout(IntPtr window,uint msg,IntPtr wp,IntPtr lp,uint flags,uint timeout,out IntPtr result);
  [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr window,out RECT rect);
  [DllImport("user32.dll")]static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int w,int h,uint flags);
  [DllImport("user32.dll")]static extern bool IsZoomed(IntPtr window);
  static POINT position;static IntPtr captured=IntPtr.Zero,dragWindow=IntPtr.Zero,ncWindow=IntPtr.Zero;static RECT dragRect;static POINT dragStart;static uint buttons;static int ncHit;
  static IntPtr Pack(int x,int y){return new IntPtr(unchecked((int)((uint)(ushort)x|((uint)(ushort)y<<16))));}
  static IntPtr Target(){return captured!=IntPtr.Zero?captured:WindowFromPoint(position);}
  static uint Mask(string button){return button=="right"?2U:button=="middle"?16U:1U;}
  static void Send(IntPtr window,uint message,uint flags,bool screen){if(window==IntPtr.Zero)return;POINT p=position;if(!screen&&!ScreenToClient(window,ref p))return;if(!PostMessage(window,message,new IntPtr(unchecked((int)flags)),Pack(p.X,p.Y)))throw new InvalidOperationException("Mouse virtual indisponivel para esta janela");}
  static int Hit(IntPtr window){IntPtr value;IntPtr ok=SendMessageTimeout(window,0x84,IntPtr.Zero,Pack(position.X,position.Y),2,40,out value);return ok==IntPtr.Zero?0:value.ToInt32();}
  static void Move(int x,int y){position=new POINT(x,y);if(dragWindow!=IntPtr.Zero){SetWindowPos(dragWindow,IntPtr.Zero,dragRect.Left+x-dragStart.X,dragRect.Top+y-dragStart.Y,0,0,0x15);return;}Send(Target(),0x200,buttons,false);}
  static void Down(string button){IntPtr window=Target();if(window==IntPtr.Zero)return;IntPtr root=GetAncestor(window,2);int hit=Hit(root);SetForegroundWindow(root);
   if(button=="left"&&hit==2&&GetWindowRect(root,out dragRect)){dragWindow=root;dragStart=position;return;}
   if(button=="left"&&(hit==8||hit==9||hit==20)){ncWindow=root;ncHit=hit;return;}
   captured=window;buttons|=Mask(button);Send(window,button=="right"?0x204U:button=="middle"?0x207U:0x201U,buttons,false);
  }
  static void Up(string button){if(button=="left"&&dragWindow!=IntPtr.Zero){dragWindow=IntPtr.Zero;return;}if(button=="left"&&ncWindow!=IntPtr.Zero){IntPtr window=ncWindow;ncWindow=IntPtr.Zero;if(Hit(window)==ncHit){int command=ncHit==20?0xF060:ncHit==8?0xF020:IsZoomed(window)?0xF120:0xF030;PostMessage(window,0x112,new IntPtr(command),IntPtr.Zero);}return;}
   IntPtr target=Target();buttons&=~Mask(button);Send(target,button=="right"?0x205U:button=="middle"?0x208U:0x202U,buttons,false);if(buttons==0)captured=IntPtr.Zero;
  }
  internal static void Execute(string[] p){string cmd=p[0];string button=p.Length>1?p[1]:"left";
   if(cmd=="VM"&&p.Length>=3)Move(int.Parse(p[1],CultureInfo.InvariantCulture),int.Parse(p[2],CultureInfo.InvariantCulture));
   else if(cmd=="VD")Down(button);else if(cmd=="VU")Up(button);else if(cmd=="VC"){Down(button);Up(button);}else if(cmd=="VDC"){IntPtr root=GetAncestor(Target(),2);if(button=="left"&&Hit(root)==2){PostMessage(root,0x112,new IntPtr(IsZoomed(root)?0xF120:0xF030),IntPtr.Zero);return;}Down(button);Up(button);Send(Target(),button=="right"?0x206U:button=="middle"?0x209U:0x203U,buttons,false);Up(button);}
   else if(cmd=="VW"&&p.Length>=2){int delta=int.Parse(p[1],CultureInfo.InvariantCulture);Send(Target(),0x20A,buttons|((uint)(ushort)delta<<16),true);}
  }
 }
}