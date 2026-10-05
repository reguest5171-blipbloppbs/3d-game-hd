import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-sleep-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- SLEEP & MORNING SUMMARY MODAL -->
    @if (gameState.isSleepSummaryOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 pointer-events-auto"
      >
        <div class="relative w-full max-w-md rounded-3xl border-2 border-amber-300/80 bg-black/90 text-white p-6 shadow-2xl flex flex-col gap-4 text-center">
          <!-- Sun icon & Title -->
          <div class="flex flex-col items-center gap-1">
            <mat-icon class="text-4xl text-amber-400 animate-spin" style="animation-duration: 12s;">
              wb_sunny
            </mat-icon>
            <h2 class="text-lg font-black text-amber-300 uppercase tracking-wider">
              Selamat Pagi! (Day {{ gameState.sleepSummary()?.day }})
            </h2>
            <p class="text-xs text-white/70">
              Musim {{ gameState.season() }} · Cuaca: {{ gameState.weather() }}
            </p>
          </div>

          <!-- Earnings Card -->
          <div class="p-4 rounded-2xl border border-amber-400/40 bg-amber-950/30 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs text-white/80">
              <span>Barang Terjual (Shipped):</span>
              <span class="font-bold">{{ gameState.sleepSummary()?.itemsSold || 0 }} item</span>
            </div>

            <div class="flex items-center justify-between text-sm font-black text-amber-300 pt-2 border-t border-white/10">
              <span>Pendapatan Hari Ini:</span>
              <span class="tabular-nums">+{{ gameState.sleepSummary()?.earned || 0 }} G</span>
            </div>
          </div>

          <div class="text-[11px] text-white/60">
            Stamina pulih sepenuhnya. Tanaman yang disiram telah bertumbuh!
          </div>

          <button
            (click)="startDay()"
            class="w-full py-3 rounded-2xl border border-amber-400 bg-amber-500 text-slate-950 font-black text-sm uppercase tracking-wide active:scale-98 transition-transform shadow-lg"
          >
            Mulai Hari Baru (Start Day)
          </button>
        </div>
      </div>
    }
  `
})
export class SleepModalComponent {
  public gameState = inject(GameStateService);

  public startDay(): void {
    this.gameState.isSleepSummaryOpen.set(false);
  }
}
