import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { World3dService } from '../../game/world-3d.service';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-action-button',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative flex items-end gap-3 pointer-events-auto select-none touch-manipulation origin-bottom-right transition-transform duration-100"
      [style.opacity]="gameState.hudOpacity()"
      [style.transform]="'scale(' + gameState.controlScale() + ')'"
      [style.transformOrigin]="'bottom right'"
      [style.marginRight.px]="-gameState.actionOffsetX()"
      [style.marginBottom.px]="gameState.actionOffsetY()"
    >
      <!-- Secondary Action Cluster: Tool button & Run toggle -->
      <div class="flex flex-col gap-2 items-center">
        <!-- Sprint / Run Toggle Button -->
        <button
          (click)="toggleRun()"
          class="w-11 h-11 rounded-full border border-white/30 bg-black/25 active:bg-white/20 flex flex-col items-center justify-center text-white transition-transform active:scale-90"
          [class.border-emerald-400]="gameState.isRunning()"
          [class.text-emerald-300]="gameState.isRunning()"
          title="Toggle Sprint / Run"
        >
          <mat-icon class="text-xl">{{ gameState.isRunning() ? 'directions_run' : 'directions_walk' }}</mat-icon>
          <span class="text-[8px] font-bold tracking-tighter uppercase leading-none mt-0.5">
            {{ gameState.isRunning() ? 'RUN' : 'WALK' }}
          </span>
        </button>

        <!-- TOOL SWITCHER BUTTON:
             - Tap -> Alat Selanjutnya
             - Swipe/Geser -> Alat Sebelumnya
             - Tekan Lama (Long Press) / Ketuk Ikon Menu -> Buka Kontainer Rak Alat Horizontal -->
        <div class="relative">
          <button
            (touchstart)="onTouchStartTool($event)"
            (touchmove)="onTouchMoveTool($event)"
            (touchend)="onTouchEndTool()"
            (touchcancel)="onTouchCancelTool()"
            (mousedown)="onMouseDownTool($event)"
            (mouseup)="onMouseUpTool($event)"
            class="w-13 h-13 rounded-full border-2 border-sky-300/70 bg-black/35 active:bg-sky-500/30 flex flex-col items-center justify-center text-white transition-transform active:scale-90 shadow-md touch-none"
            title="Tap: Ganti Alat · Tahan / Ketuk Titik Kotak: Buka Rak Alat Lengkap"
          >
            <mat-icon class="text-2xl text-sky-200">{{ currentToolIcon() }}</mat-icon>
            <span class="text-[9px] font-bold text-sky-100 uppercase tracking-tight leading-none mt-0.5">
              {{ currentToolName() }}
            </span>
          </button>

          <!-- Quick Access Button to Open Horizontal Tool Rack Directly -->
          <button
            type="button"
            (click)="openToolMenu($event)"
            class="absolute -top-1 -right-1 w-6 h-6 rounded-full border border-sky-300 bg-sky-700/90 active:bg-sky-500 text-white flex items-center justify-center shadow-md transition-transform active:scale-90 cursor-pointer"
            title="Buka Kontainer & Rak Alat Lengkap"
          >
            <mat-icon class="text-xs">apps</mat-icon>
          </button>
        </div>
      </div>

      <!-- MAIN ALL-IN-ONE CONTEXTUAL ACTION BUTTON -->
      <button
        (click)="onActionPress()"
        class="relative min-w-[76px] h-20 px-4 rounded-3xl border-2 border-amber-300/80 bg-black/35 active:bg-amber-500/40 text-white flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg overflow-hidden group"
      >
        <!-- Subtle pulsing ring on active interaction -->
        @if (gameState.currentAction().type !== 'interact') {
          <div class="absolute inset-0 rounded-3xl border border-amber-400/30 opacity-60 animate-pulse pointer-events-none"></div>
        }

        <!-- Dynamic Context Icon -->
        <mat-icon class="text-3xl text-amber-300 drop-shadow-sm group-active:scale-110 transition-transform">
          {{ gameState.currentAction().icon }}
        </mat-icon>

        <!-- Dynamic Context Label -->
        <span class="text-[11px] font-black tracking-wide uppercase text-white drop-shadow-sm leading-tight mt-0.5">
          {{ gameState.currentAction().label }}
        </span>

        <!-- Sublabel / Info -->
        @if (gameState.currentAction().subLabel) {
          <span class="text-[8px] font-medium text-amber-200/90 tracking-tight leading-none mt-0.5 max-w-[84px] truncate">
            {{ gameState.currentAction().subLabel }}
          </span>
        }
      </button>
    </div>
  `
})
export class ActionButtonComponent {
  public gameState = inject(GameStateService);
  private world3d = inject(World3dService);

  // Touch gesture & long-press tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private isLongPressTriggered = false;
  private hasSwiped = false;

  public onActionPress(): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    this.gameState.executeCurrentAction();
    this.world3d.rebuildFarmPlots();
  }

  public toggleRun(): void {
    this.gameState.isRunning.update(r => !r);
  }

  public currentToolIcon(): string {
    const cur = this.gameState.selectedTool();
    const t = this.gameState.toolsList.find(item => item.id === cur);
    return t ? t.icon : 'handyman';
  }

  public currentToolName(): string {
    const cur = this.gameState.selectedTool();
    const t = this.gameState.toolsList.find(item => item.id === cur);
    return t ? t.name : 'Tool';
  }

  public openToolMenu(e?: Event): void {
    if (e) {
      e.stopPropagation();
    }
    this.gameState.isToolMenuOpen.set(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  }

  // TOUCH EVENTS FOR TOOL BUTTON: Tap, Swipe, Long-Press
  public onTouchStartTool(e: TouchEvent): void {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
      this.isLongPressTriggered = false;
      this.hasSwiped = false;

      // Start long-press timer (~400ms)
      this.clearLongPressTimer();
      this.longPressTimer = setTimeout(() => {
        this.isLongPressTriggered = true;
        this.gameState.isToolMenuOpen.set(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(30);
        }
      }, 400);
    }
  }

  public onTouchMoveTool(e: TouchEvent): void {
    if (e.touches.length > 0 && !this.isLongPressTriggered) {
      const t = e.touches[0];
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // If moved significantly, cancel long press and recognize swipe gesture
      if (dist > 22 && !this.hasSwiped) {
        this.clearLongPressTimer();
        this.hasSwiped = true;
        // Geser / Swipe triggers Alat Sebelumnya (cycleToolPrev)
        this.gameState.cycleToolPrev();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }
    }
  }

  public onTouchEndTool(): void {
    this.clearLongPressTimer();
    if (!this.isLongPressTriggered && !this.hasSwiped) {
      // Tap detected -> Alat Selanjutnya (cycleToolNext)
      this.gameState.cycleToolNext();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    }
  }

  public onTouchCancelTool(): void {
    this.clearLongPressTimer();
  }

  // DESKTOP MOUSE FALLBACK FOR TOOL BUTTON
  public onMouseDownTool(e: MouseEvent): void {
    this.touchStartX = e.clientX;
    this.touchStartY = e.clientY;
    this.isLongPressTriggered = false;
    this.hasSwiped = false;

    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this.isLongPressTriggered = true;
      this.gameState.isToolMenuOpen.set(true);
    }, 450);
  }

  public onMouseUpTool(e: MouseEvent): void {
    const dx = e.clientX - this.touchStartX;
    const dy = e.clientY - this.touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.clearLongPressTimer();

    if (!this.isLongPressTriggered) {
      if (dist > 20) {
        // Swipe/drag detected -> previous tool
        this.gameState.cycleToolPrev();
      } else {
        // Tap detected -> next tool
        this.gameState.cycleToolNext();
      }
    }
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
