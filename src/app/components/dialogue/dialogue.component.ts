import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-dialogue',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gameState.activeDialogue()) {
      <div
        class="absolute inset-x-0 bottom-4 sm:bottom-6 mx-auto max-w-xl px-4 z-40 pointer-events-auto"
      >
        <!-- Dialogue Box (Transparent without blur) -->
        <div class="rounded-3xl border-2 border-amber-300/60 bg-black/85 text-white p-4 shadow-2xl flex flex-col gap-3">
          <!-- NPC Header -->
          <div class="flex items-center gap-3">
            <!-- NPC Avatar Circle -->
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md border border-white/30"
              [style.backgroundColor]="gameState.activeDialogue()?.npc?.color || '#3b82f6'"
            >
              {{ gameState.activeDialogue()?.npc?.name?.charAt(0) }}
            </div>

            <!-- NPC Info -->
            <div>
              <div class="text-sm font-black text-amber-300 tracking-wide">
                {{ gameState.activeDialogue()?.npc?.name }}
              </div>
              <div class="text-[11px] font-medium text-white/70">
                {{ gameState.activeDialogue()?.npc?.title }}
              </div>
            </div>

            <!-- Heart Rating -->
            <div class="ml-auto flex items-center gap-0.5 text-rose-400">
              <mat-icon class="text-sm">favorite</mat-icon>
              <span class="text-xs font-bold">{{ gameState.activeDialogue()?.npc?.hearts }}/5</span>
            </div>
          </div>

          <!-- Dialogue Text Body -->
          <div class="text-sm sm:text-base font-normal leading-relaxed text-white/95 px-1 min-h-[44px]">
            {{ gameState.activeDialogue()?.text }}
          </div>

          <!-- Choice / Action Buttons -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/15">
            @for (opt of gameState.activeDialogue()?.options; track opt.label) {
              <button
                (click)="opt.action()"
                class="px-4 py-2 rounded-xl text-xs font-bold border border-amber-300/40 bg-amber-500/20 active:bg-amber-500/40 text-amber-200 transition-all active:scale-95 shadow-sm"
              >
                {{ opt.label }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class DialogueComponent {
  public gameState = inject(GameStateService);
}
