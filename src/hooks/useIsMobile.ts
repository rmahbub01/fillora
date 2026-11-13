import { useEffect, useState } from 'react';
import { MOBILE_QUERY } from '../utils/device';

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
