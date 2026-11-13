"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [light, setLight] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem("inkwell-theme");
    const isLight = stored === "light";
    setLight(isLight);
    document.documentElement.classList.toggle("light", isLight);
  }, []);

  return (
    <button
      onClick={() => {
        const next = !light;
        setLight(next);
        document.documentElement.classList.toggle("light", next);
        localStorage.setItem("inkwell-theme", next ? "light" : "dark");
      }}
      className="rounded-md p-1.5 text-muted transition hover:bg-ink-800 hover:text-foreground"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
