import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { World3dService } from '../../game/world-3d.service';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-virtual-joystick',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #baseEl
      class="relative w-28 h-28 rounded-full border border-white/35 bg-black/25 select-none touch-none flex items-center justify-center pointer-events-auto transition-transform duration-100"
      [style.opacity]="gameState.hudOpacity()"
      [style.transform]="'scale(' + gameState.controlScale() + ')'"
      [style.transformOrigin]="'bottom left'"
      [style.marginLeft.px]="gameState.joystickOffsetX()"
      [style.marginBottom.px]="gameState.joystickOffsetY()"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd()"
      (touchcancel)="onTouchEnd()"
      (mousedown)="onMouseDown($event)"
    >
      <!-- Center indicator ring -->
      <div class="absolute w-8 h-8 rounded-full border border-white/20 pointer-events-none"></div>

      <!-- Moving Thumb Knob (No Blur, Transparent) -->
      <div
        class="w-12 h-12 rounded-full border-2 border-white/70 bg-white/25 shadow-md flex items-center justify-center transition-transform duration-75 pointer-events-none"
        [style.transform]="knobTransform()"
      >
        <mat-icon class="text-white/80 text-lg">games</mat-icon>
      </div>
    </div>
  `
})
export class VirtualJoystickComponent implements OnInit, OnDestroy {
  @ViewChild('baseEl', { static: true }) baseRef!: ElementRef<HTMLDivElement>;

  public gameState = inject(GameStateService);
  private world3d = inject(World3dService);

  public knobTransform = signal<string>('translate(0px, 0px)');
  private activeTouchId: number | null = null;
  private isMouseDown = false;
  private maxRadius = 42;

  // Keyboard keys active
  private keysPressed: Record<string, boolean> = {};

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('mouseup', this.handleMouseUp);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('mouseup', this.handleMouseUp);
    }
  }

  public onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.activeTouchId === null && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      this.activeTouchId = touch.identifier;
      this.updateJoystick(touch.clientX, touch.clientY);
    }
  }

  public onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (this.activeTouchId !== null) {
      for (const touch of Array.from(e.touches)) {
        if (touch.identifier === this.activeTouchId) {
          this.updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    }
  }

  public onTouchEnd(): void {
    this.activeTouchId = null;
    this.resetJoystick();
  }

  public onMouseDown(e: MouseEvent): void {
    this.isMouseDown = true;
    this.updateJoystick(e.clientX, e.clientY);
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.isMouseDown) {
      this.updateJoystick(e.clientX, e.clientY);
    }
  };

  private handleMouseUp = (): void => {
    if (this.isMouseDown) {
      this.isMouseDown = false;
      this.resetJoystick();
    }
  };

  private updateJoystick(clientX: number, clientY: number): void {
    const rect = this.baseRef.nativeElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let normX = 0;
    let normY = 0;

    if (distance > 0) {
      const clampedDist = Math.min(distance, this.maxRadius);
      const ratio = clampedDist / distance;
      const visualX = dx * ratio;
      const visualY = dy * ratio;

      this.knobTransform.set(`translate(${visualX}px, ${visualY}px)`);

      normX = visualX / this.maxRadius;
      normY = visualY / this.maxRadius;
    } else {
      this.resetJoystick();
      return;
    }

    this.world3d.moveVector = { x: normX, z: normY };
  }

  private resetJoystick(): void {
    this.knobTransform.set('translate(0px, 0px)');
    if (Object.keys(this.keysPressed).length === 0) {
      this.world3d.moveVector = { x: 0, z: 0 };
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
      this.keysPressed[key] = true;
      this.applyKeyboardVector();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (this.keysPressed[key]) {
      delete this.keysPressed[key];
      this.applyKeyboardVector();
    }
  };

  private applyKeyboardVector(): void {
    let x = 0;
    let z = 0;
    if (this.keysPressed['w'] || this.keysPressed['arrowup']) z -= 1;
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) z += 1;
    if (this.keysPressed['a'] || this.keysPressed['arrowleft']) x -= 1;
    if (this.keysPressed['d'] || this.keysPressed['arrowright']) x += 1;

    const len = Math.sqrt(x * x + z * z);
    if (len > 0) {
      x /= len;
      z /= len;
    }

    this.world3d.moveVector = { x, z };
    this.knobTransform.set(`translate(${x * 30}px, ${z * 30}px)`);
  }
}
