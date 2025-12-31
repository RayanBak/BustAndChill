'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

// Redirect old /game/[uuid] to new /table/[uuid]
export default function GameRedirect() {
  const params = useParams();
  const router = useRouter();
  const uuid = params.uuid as string;
  
  useEffect(() => {
    router.replace(`/table/${uuid}`);
  }, [router, uuid]);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  );
}
