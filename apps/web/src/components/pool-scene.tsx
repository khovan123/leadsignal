'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line } from '@react-three/drei';
import { useRef } from 'react';
import type { Mesh } from 'three';

function Node({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.35; });
  return <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}><mesh ref={ref} position={position} scale={scale}><icosahedronGeometry args={[0.45, 1]}/><meshStandardMaterial color="#8070ff" emissive="#2a1f74" roughness={0.25}/></mesh></Float>;
}

export function PoolScene() {
  return <div className="h-[300px] w-full" aria-hidden="true"><Canvas camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 1.5]}><ambientLight intensity={1.4}/><pointLight position={[3, 3, 4]} intensity={25}/><Node position={[0,0,0]} scale={1.35}/><Node position={[-2,1,0]}/><Node position={[2,1,0]}/><Node position={[-1.6,-1.4,0]}/><Node position={[1.6,-1.4,0]}/><Line points={[[-2,1,0],[0,0,0],[2,1,0]]} color="#475569"/><Line points={[[0,0,0],[-1.6,-1.4,0]]} color="#475569"/><Line points={[[0,0,0],[1.6,-1.4,0]]} color="#475569"/></Canvas></div>;
}
