import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-settings-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gameState.isSettingsOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150"
      >
        <!-- Backdrop button -->
        <button
          type="button"
          aria-label="Tutup latar belakang"
          (click)="close()"
          class="absolute inset-0 bg-black/80 cursor-default"
        ></button>

        <!-- Settings Modal Window (Transparent without blur) -->
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full max-w-lg rounded-3xl border-2 border-sky-300/70 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto z-10"
        >
          <!-- Sticky Header with Guaranteed Visible Close Button -->
          <div class="sticky top-0 z-20 flex items-center justify-between border-b border-white/20 pb-2.5 bg-neutral-950/95 -mt-1 pt-1">
            <div class="flex items-center gap-2">
              <mat-icon class="text-sky-400">settings</mat-icon>
              <h2 class="text-sm sm:text-base font-black text-sky-300 uppercase tracking-wide">
                Pengaturan Kontrol & Audio
              </h2>
            </div>

            <button
              (click)="close()"
              type="button"
              class="px-3 py-1.5 rounded-full border border-white/30 bg-white/10 hover:bg-white/25 active:bg-sky-500/40 text-white flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
              title="Tutup Pengaturan"
            >
              <mat-icon class="text-sm">close</mat-icon>
              <span>Tutup</span>
            </button>
          </div>

          <!-- Section 1: Pengatur Suara (Audio Settings) -->
          <div class="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-bold text-white">
                <mat-icon class="text-amber-400 text-lg">volume_up</mat-icon>
                <span>Efek Suara Game (SFX)</span>
              </div>
              <button
                (click)="toggleSound()"
                class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5"
                [class.border-emerald-400]="isSoundOn()"
                [class.bg-emerald-500/25]="isSoundOn()"
                [class.text-emerald-300]="isSoundOn()"
                [class.border-rose-400]="!isSoundOn()"
                [class.bg-rose-500/25]="!isSoundOn()"
                [class.text-rose-300]="!isSoundOn()"
              >
                <mat-icon class="text-sm">{{ isSoundOn() ? 'check' : 'close' }}</mat-icon>
                <span>{{ isSoundOn() ? 'AKTIF (ON)' : 'MATI (MUTED)' }}</span>
              </button>
            </div>

            <div class="flex items-center justify-between text-[11px] text-white/60">
              <span>Suara cangkul, siram air, petik panen, dan suara hewan ternak.</span>
              <button
                (click)="testSound()"
                class="px-2 py-1 rounded-lg text-[10px] font-bold border border-white/20 bg-white/10 active:bg-white/20 text-white"
              >
                Tes Suara 🔊
              </button>
            </div>
          </div>

          <!-- Section 1B: Mode Grafis & Bayangan Dinamis (60 FPS Performance Mode) -->
          <div class="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-bold text-white">
                <mat-icon class="text-amber-400 text-lg">wb_sunny</mat-icon>
                <span>Bayangan Dinamis Matahari</span>
              </div>
              <button
                (click)="toggleShadows()"
                class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5"
                [class.border-emerald-400]="isShadowsOn()"
                [class.bg-emerald-500/25]="isShadowsOn()"
                [class.text-emerald-300]="isShadowsOn()"
                [class.border-sky-400]="!isShadowsOn()"
                [class.bg-sky-500/25]="!isShadowsOn()"
                [class.text-sky-300]="!isShadowsOn()"
              >
                <mat-icon class="text-sm">{{ isShadowsOn() ? 'wb_sunny' : 'bolt' }}</mat-icon>
                <span>{{ isShadowsOn() ? 'AKTIF (Shadow Map)' : 'HEMAT (Ultra 60 FPS)' }}</span>
              </button>
            </div>

            <div class="text-[11px] text-white/60">
              {{ isShadowsOn() ? 'Rendering bayangan dinamis aktif dengan kamera bayangan presisi.' : 'Mode Hemat: Menggunakan bayangan kontak artistik bebas lag, sangat lancar untuk HP low-end.' }}
            </div>
          </div>

          <!-- Section 1C: Efek Tilt-Shift / Diorama Miniatur (Aesthetic Depth) -->
          <div class="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-bold text-white">
                <mat-icon class="text-violet-400 text-lg">blur_linear</mat-icon>
                <span>Efek Tilt-Shift Miniatur</span>
              </div>
              <button
                (click)="toggleTiltShift()"
                class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5"
                [class.border-violet-400]="isTiltShiftOn()"
                [class.bg-violet-500/25]="isTiltShiftOn()"
                [class.text-violet-300]="isTiltShiftOn()"
                [class.border-slate-500]="!isTiltShiftOn()"
                [class.bg-white/10]="!isTiltShiftOn()"
                [class.text-white/70]="!isTiltShiftOn()"
              >
                <mat-icon class="text-sm">{{ isTiltShiftOn() ? 'camera' : 'blur_off' }}</mat-icon>
                <span>{{ isTiltShiftOn() ? 'AKTIF (Diorama Blur)' : 'MATI (Off)' }}</span>
              </button>
            </div>

            <div class="text-[11px] text-white/60">
              Efek blur halus di tepi atas dan bawah layar menggunakan fragment shader untuk visual miniature aesthetic ala Tree of Tranquility.
            </div>
          </div>

          <!-- Section 2: Transparansi HUD & Kontroler (Opacity Adjust) -->
          <div class="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-bold text-white">
                <mat-icon class="text-sky-400 text-lg">opacity</mat-icon>
                <span>Transparansi HUD & Kontroler (Opacity)</span>
              </div>
              <span class="text-xs font-black text-sky-300 tabular-nums">
                {{ opacityPercent() }}%
              </span>
            </div>

            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              [value]="gameState.hudOpacity()"
              (input)="onOpacityChange($event)"
              class="w-full accent-sky-400 cursor-pointer h-2 bg-white/20 rounded-lg appearance-none"
            />
            <div class="flex justify-between text-[9px] text-white/50">
              <span>Sangat Transparan (20%)</span>
              <span>Rekomendasi (75%)</span>
              <span>Pekat (100%)</span>
            </div>
          </div>

          <!-- Section 3: Ukuran Tombol Kontroler (Button Size Adjust) -->
          <div class="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-bold text-white">
                <mat-icon class="text-amber-400 text-lg">aspect_ratio</mat-icon>
                <span>Ukuran Tombol & Joystick (Button Size)</span>
              </div>
              <span class="text-xs font-black text-amber-300 tabular-nums">
                {{ scalePercent() }}%
              </span>
            </div>

            <!-- Size Presets -->
            <div class="grid grid-cols-4 gap-1.5">
              <button
                (click)="setScale(0.85)"
                class="py-1.5 rounded-xl text-xs font-bold border transition-all"
                [class.border-amber-400]="gameState.controlScale() === 0.85"
                [class.bg-amber-500/30]="gameState.controlScale() === 0.85"
                [class.border-white/20]="gameState.controlScale() !== 0.85"
              >
                Kecil (85%)
              </button>
              <button
                (click)="setScale(1.0)"
                class="py-1.5 rounded-xl text-xs font-bold border transition-all"
                [class.border-amber-400]="gameState.controlScale() === 1.0"
                [class.bg-amber-500/30]="gameState.controlScale() === 1.0"
                [class.border-white/20]="gameState.controlScale() !== 1.0"
              >
                Normal (100%)
              </button>
              <button
                (click)="setScale(1.15)"
                class="py-1.5 rounded-xl text-xs font-bold border transition-all"
                [class.border-amber-400]="gameState.controlScale() === 1.15"
                [class.bg-amber-500/30]="gameState.controlScale() === 1.15"
                [class.border-white/20]="gameState.controlScale() !== 1.15"
              >
                Besar (115%)
              </button>
              <button
                (click)="setScale(1.30)"
                class="py-1.5 rounded-xl text-xs font-bold border transition-all"
                [class.border-amber-400]="gameState.controlScale() === 1.30"
                [class.bg-amber-500/30]="gameState.controlScale() === 1.30"
                [class.border-white/20]="gameState.controlScale() !== 1.30"
              >
                Ekstra (130%)
              </button>
            </div>
          </div>

          <!-- Section 3B: Developer Mode / Map Editor (Dev Mode) -->
          <div class="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-950/10 flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-bold text-amber-300">
                <mat-icon class="text-amber-400 text-lg">construction</mat-icon>
                <span>Developer Map Terrain Editor</span>
              </div>
              <button
                (click)="toggleDevEditor()"
                class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer"
                [class.border-amber-400]="gameState.isDevEditorOpen()"
                [class.bg-amber-500/25]="gameState.isDevEditorOpen()"
                [class.text-amber-300]="gameState.isDevEditorOpen()"
                [class.border-white/20]="!gameState.isDevEditorOpen()"
                [class.text-white/60]="!gameState.isDevEditorOpen()"
              >
                <mat-icon class="text-sm">{{ gameState.isDevEditorOpen() ? 'build' : 'close' }}</mat-icon>
                <span>{{ gameState.isDevEditorOpen() ? 'AKTIF (ON)' : 'MATI (OFF)' }}</span>
              </button>
            </div>
            <div class="text-[11px] text-white/60">
              Aktifkan editor medan tanah 3D untuk memahat ketinggian tanah (*sculpting*) serta menaruh objek dekorasi secara langsung di Pulau Solaria.
            </div>
          </div>

          <!-- Section 4: Posisi Kontroler (Controller Position Modifier) -->
          <div class="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-3">
            <div class="flex items-center gap-2 text-xs font-bold text-white">
              <mat-icon class="text-emerald-400 text-lg">tune</mat-icon>
              <span>Penyesuaian Posisi Kontroler (Position Modifier)</span>
            </div>

            <!-- Virtual Joystick Position Offset -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-white/80">Posisi Joystick (Kiri / Kanan):</span>
              <div class="flex items-center gap-2">
                <button
                  (click)="adjustJoystickX(-10)"
                  class="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
                >
                  ◀
                </button>
                <span class="text-xs font-bold tabular-nums w-10 text-center text-emerald-300">
                  {{ gameState.joystickOffsetX() > 0 ? '+' : '' }}{{ gameState.joystickOffsetX() }}px
                </span>
                <button
                  (click)="adjustJoystickX(10)"
                  class="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
                >
                  ▶
                </button>
              </div>
            </div>

            <!-- Action Button Position Offset -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-white/80">Posisi Tombol Aksi (Kiri / Kanan):</span>
              <div class="flex items-center gap-2">
                <button
                  (click)="adjustActionX(-10)"
                  class="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
                >
                  ◀
                </button>
                <span class="text-xs font-bold tabular-nums w-10 text-center text-emerald-300">
                  {{ gameState.actionOffsetX() > 0 ? '+' : '' }}{{ gameState.actionOffsetX() }}px
                </span>
                <button
                  (click)="adjustActionX(10)"
                  class="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
                >
                  ▶
                </button>
              </div>
            </div>

            <!-- Height / Vertical Offset -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-white/80">Ketinggian Tombol (Bawah / Atas):</span>
              <div class="flex items-center gap-2">
                <button
                  (click)="adjustOffsetY(-10)"
                  class="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
                >
                  ▼
                </button>
                <span class="text-xs font-bold tabular-nums w-10 text-center text-emerald-300">
                  {{ gameState.joystickOffsetY() > 0 ? '+' : '' }}{{ gameState.joystickOffsetY() }}px
                </span>
                <button
                  (click)="adjustOffsetY(10)"
                  class="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
                >
                  ▲
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Actions: Reset to Default & Selesai -->
          <div class="flex items-center justify-between pt-2 border-t border-white/15">
            <button
              (click)="resetDefaults()"
              class="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-400/40 bg-rose-950/40 text-rose-300 active:scale-95 transition-transform"
            >
              Reset ke Default
            </button>

            <button
              (click)="close()"
              class="px-5 py-2 rounded-xl text-xs font-bold border border-sky-400 bg-sky-500 text-slate-950 uppercase tracking-wide active:scale-95 transition-transform"
            >
              Simpan & Tutup
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SettingsModalComponent {
  public gameState = inject(GameStateService);
  private audio = inject(AudioService);

  public isSoundOn(): boolean {
    return this.audio.isSoundEnabled();
  }

  public toggleSound(): void {
    this.audio.toggleSound();
  }

  public testSound(): void {
    this.audio.playHarvest();
  }

  public isShadowsOn(): boolean {
    return this.gameState.shadowsEnabled();
  }

  public toggleShadows(): void {
    this.gameState.shadowsEnabled.update((v) => !v);
    this.gameState.saveSettings();
  }

  public isTiltShiftOn(): boolean {
    return this.gameState.tiltShiftEnabled();
  }

  public toggleTiltShift(): void {
    this.gameState.tiltShiftEnabled.update((v) => !v);
    this.gameState.saveSettings();
  }

  public opacityPercent(): number {
    return Math.round(this.gameState.hudOpacity() * 100);
  }

  public scalePercent(): number {
    return Math.round(this.gameState.controlScale() * 100);
  }

  public onOpacityChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const val = parseFloat(target.value);
    this.gameState.hudOpacity.set(val);
    this.gameState.saveSettings();
  }

  public setScale(scale: number): void {
    this.gameState.controlScale.set(scale);
    this.gameState.saveSettings();
  }

  public adjustJoystickX(delta: number): void {
    const cur = this.gameState.joystickOffsetX();
    const next = Math.max(-50, Math.min(50, cur + delta));
    this.gameState.joystickOffsetX.set(next);
    this.gameState.saveSettings();
  }

  public adjustActionX(delta: number): void {
    const cur = this.gameState.actionOffsetX();
    const next = Math.max(-50, Math.min(50, cur + delta));
    this.gameState.actionOffsetX.set(next);
    this.gameState.saveSettings();
  }

  public adjustOffsetY(delta: number): void {
    const cur = this.gameState.joystickOffsetY();
    const next = Math.max(-40, Math.min(40, cur + delta));
    this.gameState.joystickOffsetY.set(next);
    this.gameState.actionOffsetY.set(next);
    this.gameState.saveSettings();
  }

  public toggleDevEditor(): void {
    const nextVal = !this.gameState.isDevEditorOpen();
    this.gameState.isDevEditorOpen.set(nextVal);
    this.gameState.isSettingsOpen.set(false); // Close settings when entering editor
    if (nextVal) {
      this.gameState.showToast('🛠️ Mode Map Editor diaktifkan! Gunakan kuas untuk memahat tanah.');
    } else {
      this.gameState.showToast('ℹ️ Mode Map Editor dinonaktifkan.');
    }
  }

  public resetDefaults(): void {
    this.gameState.resetSettings();
  }

  public close(): void {
    this.gameState.isSettingsOpen.set(false);
  }
}
