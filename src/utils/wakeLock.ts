let wakeLock: any = null;

export const requestWakeLock = async () => {
  if (typeof window !== "undefined" && "wakeLock" in navigator) {
    try {
      // @ts-ignore
      wakeLock = await navigator.wakeLock.request("screen");
      console.log("Screen Wake Lock is active");
      
      wakeLock.addEventListener('release', () => {
        console.log("Screen Wake Lock was released");
      });
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  }
};

export const releaseWakeLock = () => {
  if (wakeLock !== null) {
    wakeLock.release()
      .then(() => {
        wakeLock = null;
      });
  }
};
