import React, { useEffect, useRef, useState } from 'react';
import { useGameState } from '../services/game-state';
import { world3dService } from '../game/world-3d';

export const VirtualJoystick: React.FC = () => {
  const gameState = useGameState();
  const baseElRef = useRef<HTMLDivElement | null>(null);
  const [knobTransform, setKnobTransform] = useState('translate(0px, 0px)');
  const activeTouchIdRef = useRef<number | null>(null);
  const isMouseDownRef = useRef(false);
  const maxRadius = 42;

  // Use keysPressed Ref to handle multiple keys smoothly without rendering triggers on each keystroke
  const keysPressedRef = useRef<Record<string, boolean>>({});

  const applyKeyboardVector = () => {
    let x = 0;
    let z = 0;
    const kp = keysPressedRef.current;
    if (kp['w'] || kp['arrowup']) z -= 1;
    if (kp['s'] || kp['arrowdown']) z += 1;
    if (kp['a'] || kp['arrowleft']) x -= 1;
    if (kp['d'] || kp['arrowright']) x += 1;

    const len = Math.sqrt(x * x + z * z);
    if (len > 0) {
      x /= len;
      z /= len;
    }

    world3dService.moveVector = { x, z };
    setKnobTransform(`translate(${x * 30}px, ${z * 30}px)`);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
      keysPressedRef.current[key] = true;
      applyKeyboardVector();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (keysPressedRef.current[key]) {
      delete keysPressedRef.current[key];
      applyKeyboardVector();
    }
  };

  const resetJoystick = () => {
    setKnobTransform('translate(0px, 0px)');
    if (Object.keys(keysPressedRef.current).length === 0) {
      world3dService.moveVector = { x: 0, z: 0 };
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!baseElRef.current) return;
    const rect = baseElRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let normX = 0;
    let normY = 0;

    if (distance > 0) {
      const clampedDist = Math.min(distance, maxRadius);
      const ratio = clampedDist / distance;
      const visualX = dx * ratio;
      const visualY = dy * ratio;

      setKnobTransform(`translate(${visualX}px, ${visualY}px)`);

      normX = visualX / maxRadius;
      normY = visualY / maxRadius;
    } else {
      resetJoystick();
      return;
    }

    world3dService.moveVector = { x: normX, z: normY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isMouseDownRef.current) {
        updateJoystick(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        resetJoystick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (activeTouchIdRef.current === null && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      activeTouchIdRef.current = touch.identifier;
      updateJoystick(touch.clientX, touch.clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (activeTouchIdRef.current !== null) {
      for (const touch of Array.from(e.touches)) {
        if (touch.identifier === activeTouchIdRef.current) {
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    }
  };

  const onTouchEnd = () => {
    activeTouchIdRef.current = null;
    resetJoystick();
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isMouseDownRef.current = true;
    updateJoystick(e.clientX, e.clientY);
  };

  return (
    <div
      ref={baseElRef}
      className="relative w-28 h-28 rounded-full border border-white/35 bg-black/25 select-none touch-none flex items-center justify-center pointer-events-auto transition-transform duration-100"
      style={{
        opacity: gameState.hudOpacity,
        transform: `scale(${gameState.controlScale})`,
        transformOrigin: 'bottom left',
        marginLeft: `${gameState.joystickOffsetX}px`,
        marginBottom: `${gameState.joystickOffsetY}px`,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      {/* Center indicator ring */}
      <div className="absolute w-8 h-8 rounded-full border border-white/20 pointer-events-none"></div>

      {/* Moving Thumb Knob */}
      <div
        className="w-12 h-12 rounded-full border-2 border-white/70 bg-white/25 shadow-md flex items-center justify-center transition-transform duration-75 pointer-events-none"
        style={{ transform: knobTransform }}
      >
        <span className="material-icons text-white/80 text-lg">games</span>
      </div>
    </div>
  );
};
