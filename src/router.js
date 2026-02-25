// SPA Router (History API) with GitHub Pages support (base path + 404 redirect param)
export class Router {
  constructor({ onRoute, knownRoutes = [] }) {
    this.onRoute = onRoute;
    this.knownRoutes = knownRoutes;
    this.base = this.detectBase();

    window.addEventListener("popstate", () => this.handle(this.getRouteFromLocation()));

    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-route]");
      if (!a) return;
      e.preventDefault();
      const route = a.getAttribute("data-route");
      this.go(route);
    });
  }

  detectBase() {
    let path = (location.pathname || "/").replace(/\/index\.html$/, "");
    const routes = (this.knownRoutes || []).slice().sort((a, b) => b.length - a.length);

    for (const r of routes) {
      if (!r || r === "/") continue;
      if (path.endsWith(r)) {
        return path.slice(0, -r.length).replace(/\/$/, "");
      }
    }
    // If we're at "/repo/" (GitHub Pages), base should be "/repo"
    return path.replace(/\/$/, "");
  }

  getRouteFromLocation() {
    let path = (location.pathname || "/").replace(/\/index\.html$/, "");
    let route = path;

    if (this.base && route.startsWith(this.base)) {
      route = route.slice(this.base.length);
    }
    if (!route) route = "/home";
    if (!route.startsWith("/")) route = "/" + route;
    if (route === "/") route = "/home";

    return route;
  }

  toUrl(route) {
    const r = (route || "/home").startsWith("/") ? route : ("/" + route);
    return (this.base || "") + r;
  }

  start(defaultRoute = "/home") {
    // GitHub Pages 404.html can redirect to "/?r=/report" — we recover and rewrite the URL
    const params = new URLSearchParams(location.search);
    const r = params.get("r");
    if (r) {
      const route = r.startsWith("/") ? r : ("/" + r);
      const base = (location.pathname || "/").replace(/\/index\.html$/, "").replace(/\/$/, "");
      history.replaceState({}, "", (base || "") + route);
    }

    const route = this.getRouteFromLocation();
    this.handle(route === "/" ? defaultRoute : route);
  }

  go(route) {
    const url = this.toUrl(route);
    const current = (location.pathname || "/").replace(/\/index\.html$/, "");
    if (current === url) return;
    history.pushState({}, "", url);
    this.handle(route);
  }

  handle(route) {
    this.onRoute(route);
  }
}
