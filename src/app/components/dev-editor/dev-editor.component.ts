import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GameStateService } from '../../services/game-state.service';
import { World3dService } from '../../game/world-3d.service';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-dev-editor',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gameState.isDevEditorOpen()) {
      <div class="fixed inset-0 z-40 bg-black/10 flex flex-col justify-between pointer-events-none p-3 sm:p-5">
        <!-- TOP ROW: Tool Selection, Export & Import -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full pointer-events-auto">
          <!-- Left: Dev mode indicator & Quick exit -->
          <div class="flex items-center gap-2 px-3.5 py-2 bg-black/60 border border-white/15 rounded-2xl text-white shadow-lg">
            <mat-icon class="text-amber-400">construction</mat-icon>
            <div class="flex flex-col">
              <span class="text-xs font-black tracking-wider uppercase">DEV ENVIRONMENT</span>
              <span class="text-[9px] text-white/50 font-medium">Klik & Seret di tanah untuk mengedit</span>
            </div>
            <button
              type="button"
              (click)="exitEditor()"
              class="ml-3 px-3 py-1.5 rounded-xl bg-rose-500/80 hover:bg-rose-600 border border-rose-400/30 text-white text-[10px] font-black tracking-wide flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
            >
              <mat-icon class="text-xs">exit_to_app</mat-icon>
              <span>KELUAR</span>
            </button>

            <!-- Toggle Grid Helper Button -->
            <button
              type="button"
              (click)="toggleGrid()"
              [class.bg-amber-500/30]="gameState.isDevGridVisible()"
              [class.border-amber-400/60]="gameState.isDevGridVisible()"
              [class.text-amber-300]="gameState.isDevGridVisible()"
              class="ml-1.5 px-2 py-1.5 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              [title]="gameState.isDevGridVisible() ? 'Sembunyikan Kisi 3D (Grid Helper)' : 'Tampilkan Kisi 3D (Grid Helper)'"
            >
              <mat-icon class="text-xs">grid_on</mat-icon>
            </button>
          </div>

          <!-- Center: Tool Selector Pills -->
          <div class="flex items-center gap-1 px-2.5 py-1.5 bg-black/60 border border-white/15 rounded-2xl shadow-lg self-center overflow-x-auto max-w-full">
            <button
              type="button"
              (click)="setTool('sculpt_raise')"
              [class.bg-amber-500/30]="gameState.devEditorTool() === 'sculpt_raise'"
              [class.border-amber-400/60]="gameState.devEditorTool() === 'sculpt_raise'"
              [class.text-amber-300]="gameState.devEditorTool() === 'sculpt_raise'"
              class="px-3 py-1.5 rounded-xl border border-transparent hover:bg-white/5 text-white/75 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <mat-icon class="text-sm">expand_less</mat-icon>
              <span>PAHAT NAIK</span>
            </button>

            <button
              type="button"
              (click)="setTool('sculpt_lower')"
              [class.bg-amber-500/30]="gameState.devEditorTool() === 'sculpt_lower'"
              [class.border-amber-400/60]="gameState.devEditorTool() === 'sculpt_lower'"
              [class.text-amber-300]="gameState.devEditorTool() === 'sculpt_lower'"
              class="px-3 py-1.5 rounded-xl border border-transparent hover:bg-white/5 text-white/75 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <mat-icon class="text-sm">expand_more</mat-icon>
              <span>PAHAT TURUN</span>
            </button>

            <button
              type="button"
              (click)="setTool('place_prop')"
              [class.bg-amber-500/30]="gameState.devEditorTool() === 'place_prop'"
              [class.border-amber-400/60]="gameState.devEditorTool() === 'place_prop'"
              [class.text-amber-300]="gameState.devEditorTool() === 'place_prop'"
              class="px-3 py-1.5 rounded-xl border border-transparent hover:bg-white/5 text-white/75 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <mat-icon class="text-sm">nature_people</mat-icon>
              <span>PASANG OBJEK</span>
            </button>

            <button
              type="button"
              (click)="setTool('delete_prop')"
              [class.bg-amber-500/30]="gameState.devEditorTool() === 'delete_prop'"
              [class.border-amber-400/60]="gameState.devEditorTool() === 'delete_prop'"
              [class.text-amber-300]="gameState.devEditorTool() === 'delete_prop'"
              class="px-3 py-1.5 rounded-xl border border-transparent hover:bg-white/5 text-white/75 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <mat-icon class="text-sm">delete</mat-icon>
              <span>HAPUS OBJEK</span>
            </button>
          </div>

          <!-- Right: Import / Export Files -->
          <div class="flex items-center gap-1.5 px-2 py-1.5 bg-black/60 border border-white/15 rounded-2xl shadow-lg">
            <button
              type="button"
              (click)="exportMap()"
              class="px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1 border border-emerald-500/20 active:scale-95 transition-transform cursor-pointer"
              title="Ekspor data ketinggian dan objek ke JSON kustom"
            >
              <mat-icon class="text-xs">download</mat-icon>
              <span>EKSPOR JSON</span>
            </button>

            <button
              type="button"
              (click)="triggerFileInput()"
              class="px-3 py-1.5 rounded-xl bg-sky-600/80 hover:bg-sky-600 text-white text-[10px] font-black flex items-center gap-1 border border-sky-500/20 active:scale-95 transition-transform cursor-pointer"
              title="Impor file JSON peta kustom Anda"
            >
              <mat-icon class="text-xs">upload</mat-icon>
              <span>IMPOR JSON</span>
            </button>
            <input
              #fileInput
              type="file"
              accept=".json"
              (change)="onFileSelected($event)"
              class="hidden"
            />
          </div>
        </div>

        <!-- RIGHT SIDE: QUICK PROP SELECTION LIST (Only when 'place_prop' tool is selected) -->
        @if (gameState.devEditorTool() === 'place_prop') {
          <div class="absolute right-4 top-24 sm:top-20 flex flex-col gap-2 bg-black/60 border border-white/15 p-3 rounded-2xl max-w-[170px] shadow-2xl animate-in slide-in-from-right duration-300 pointer-events-auto">
            <span class="text-[9px] font-black tracking-wider text-amber-300 uppercase mb-1">Daftar Objek (Props)</span>
            
            <button
              type="button"
              (click)="setProp('maple_tree')"
              [class.bg-white/15]="gameState.devSelectedProp() === 'maple_tree'"
              [class.text-amber-300]="gameState.devSelectedProp() === 'maple_tree'"
              class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-[10px] text-left transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <mat-icon class="text-xs">spa</mat-icon>
              <span>Pohon Maple</span>
            </button>

            <button
              type="button"
              (click)="setProp('pine_tree')"
              [class.bg-white/15]="gameState.devSelectedProp() === 'pine_tree'"
              [class.text-amber-300]="gameState.devSelectedProp() === 'pine_tree'"
              class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-[10px] text-left transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <mat-icon class="text-xs">terrain</mat-icon>
              <span>Pohon Pinus</span>
            </button>

            <button
              type="button"
              (click)="setProp('rustic_fence')"
              [class.bg-white/15]="gameState.devSelectedProp() === 'rustic_fence'"
              [class.text-amber-300]="gameState.devSelectedProp() === 'rustic_fence'"
              class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-[10px] text-left transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <mat-icon class="text-xs">grid_3x3</mat-icon>
              <span>Pagar Rustic</span>
            </button>

            <button
              type="button"
              (click)="setProp('bench')"
              [class.bg-white/15]="gameState.devSelectedProp() === 'bench'"
              [class.text-amber-300]="gameState.devSelectedProp() === 'bench'"
              class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-[10px] text-left transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <mat-icon class="text-xs">chair</mat-icon>
              <span>Kursi Taman</span>
            </button>

            <button
              type="button"
              (click)="setProp('boulder')"
              [class.bg-white/15]="gameState.devSelectedProp() === 'boulder'"
              [class.text-amber-300]="gameState.devSelectedProp() === 'boulder'"
              class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-[10px] text-left transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <mat-icon class="text-xs">category</mat-icon>
              <span>Batu Boulder</span>
            </button>
          </div>
        }

        <!-- BOTTOM PANEL: BRUSH SIZE & STRENGTH SLIDERS (Transparent without blur) -->
        <div class="w-full bg-black/40 border border-white/15 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-2xl animate-in slide-in-from-bottom duration-300 mt-auto pointer-events-auto">
          <div class="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4 text-white">
            <!-- Brush Radius Slider -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-[10px] font-bold text-white/70">
                <span>Radius Kuas (*Brush Radius*)</span>
                <span class="text-amber-300 font-mono">{{ brushRadius().toFixed(1) }}m</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.5"
                [value]="brushRadius()"
                (input)="onRadiusChange($event)"
                class="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
              />
            </div>

            <!-- Brush Strength Slider -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-[10px] font-bold text-white/70">
                <span>Kekuatan Kuas (*Brush Strength*)</span>
                <span class="text-amber-300 font-mono">{{ brushStrengthPercent() }}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                [value]="brushStrength()"
                (input)="onStrengthChange($event)"
                class="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class DevEditorComponent {
  public gameState = inject(GameStateService);
  private world3d = inject(World3dService);
  private audio = inject(AudioService);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  public brushRadius(): number {
    return this.gameState.devBrushRadius();
  }

  public brushStrength(): number {
    return this.gameState.devBrushStrength();
  }

  public brushStrengthPercent(): number {
    return Math.round(this.gameState.devBrushStrength() * 100);
  }

  public setTool(tool: 'sculpt_raise' | 'sculpt_lower' | 'place_prop' | 'delete_prop'): void {
    this.audio.playSelect();
    this.gameState.devEditorTool.set(tool);
    this.gameState.showToast(`Alat Editor: ${this.getToolName(tool)}`);
  }

  public setProp(prop: string): void {
    this.audio.playSelect();
    this.gameState.devSelectedProp.set(prop);
    this.gameState.showToast(`Objek Terpilih: ${this.getPropName(prop)}`);
  }

  public onRadiusChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.gameState.devBrushRadius.set(val);
  }

  public onStrengthChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.gameState.devBrushStrength.set(val);
  }

  public exportMap(): void {
    this.audio.playSelect();
    this.world3d.exportMapData();
  }

  public triggerFileInput(): void {
    this.audio.playSelect();
    this.fileInputRef.nativeElement.click();
  }

  public onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          this.world3d.importMapData(text);
        }
      };
      reader.readAsText(file);
      input.value = ''; // Reset input to allow choosing same file
    }
  }

  public toggleGrid(): void {
    this.audio.playSelect();
    const nextVal = !this.gameState.isDevGridVisible();
    this.gameState.isDevGridVisible.set(nextVal);
    this.gameState.showToast(`Kisi 3D (Grid Helper): ${nextVal ? 'AKTIF (TAMPIL)' : 'MATI (SEMBUNYI)'}`);
  }

  public exitEditor(): void {
    this.audio.playSelect();
    this.gameState.isDevEditorOpen.set(false);
    this.world3d.exitDevEditor();
    this.gameState.showToast('ℹ️ Mode Map Editor dinonaktifkan.');
  }

  private getToolName(tool: string): string {
    switch (tool) {
      case 'sculpt_raise': return 'Pahat Ketinggian (Naikkan)';
      case 'sculpt_lower': return 'Pahat Ketinggian (Turunkan)';
      case 'place_prop': return 'Pasang Objek';
      case 'delete_prop': return 'Hapus Objek';
      default: return tool;
    }
  }

  private getPropName(prop: string): string {
    switch (prop) {
      case 'maple_tree': return 'Pohon Maple';
      case 'pine_tree': return 'Pohon Pinus';
      case 'rustic_fence': return 'Pagar Rustic';
      case 'bench': return 'Kursi Taman';
      case 'boulder': return 'Batu Boulder';
      default: return prop;
    }
  }
}
