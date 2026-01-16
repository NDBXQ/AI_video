import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/shared/session"

const protectedPrefixes = ["/", "/script", "/video", "/library", "/help"]

/**
 * 判断当前路径是否需要登录
 * @param {string} pathname - 请求路径
 * @returns {boolean} 是否受保护
 */
function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true
  return protectedPrefixes.some((p) => p !== "/" && pathname.startsWith(p))
}

/**
 * Next.js Middleware：保护需要登录的页面
 * @param {NextRequest} req - 请求对象
 * @returns {Promise<NextResponse>} 响应
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api")) return NextResponse.next()
  if (pathname.startsWith("/_next")) return NextResponse.next()
  if (pathname === "/favicon.ico") return NextResponse.next()

  const session = await getSessionFromRequest(req)

  if (pathname === "/login") {
    if (session) {
      const url = req.nextUrl.clone()
      url.pathname = "/"
      url.search = ""
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  if (!isProtectedPath(pathname)) return NextResponse.next()

  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
}
