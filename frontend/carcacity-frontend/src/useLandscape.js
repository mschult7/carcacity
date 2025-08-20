import { useEffect, useState } from "react";

function getIsLandscape() {
  if (window.screen && window.screen.orientation && window.screen.orientation.type) {
    // Use screen.orientation API if available
    return window.screen.orientation.type.startsWith("landscape");
  }
  // Fallback to inner dimensions
  return window.innerWidth > window.innerHeight;
}

/**
 * Returns true if device is in landscape orientation.
 */
export default function useLandscape() {
  const [isLandscape, setIsLandscape] = useState(getIsLandscape());

  useEffect(() => {
    const update = () => setIsLandscape(getIsLandscape());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    // Some mobile browsers delay applying new dimensions!
    let timeout;
    const delayedUpdate = () => {
      timeout = setTimeout(update, 300); // 300ms delay after orientationchange
    };
    window.addEventListener("orientationchange", delayedUpdate);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("orientationchange", delayedUpdate);
      clearTimeout(timeout);
    };
  }, []);

  return isLandscape;
}