'use client';

import dynamic from 'next/dynamic';

const PoolScene = dynamic(
  () => import('./pool-scene.js').then((module) => module.PoolScene),
  {
    ssr: false,
    loading: () => <div className="h-[300px]" />,
  },
);

export function PoolSceneLazy() {
  return <PoolScene />;
}
