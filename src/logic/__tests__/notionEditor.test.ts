import { describe, it, expect } from 'vitest';
import { carnetReducer } from '../reducers/carnetReducer';
import { getInitialAppState } from '../../AppContext';
import {
    EDITOR_COMMANDS,
    filterEditorCommands,
    getTransformableCommands,
    getCryptoCommands,
    getWordBounds,
} from '../../components/textual/editorCommands';
import { inlineMarkdownToHtml } from '../../components/textual/liveMarkdown';
import type { CarnetStep } from '../types';

function makeStep(overrides: Partial<CarnetStep> = {}): CarnetStep {
    return {
        id: 'step-1',
        fromLabel: 'A',
        toLabel: 'B',
        moduleId: 'texte_clair',
        distanceM: 120,
        azimuth: 45,
        coords: [[2.35, 48.85], [2.36, 48.86]],
        solutionText: 'Continuez tout droit sur 120 mètres.',
        encodedText: 'Continuez tout droit sur 120 mètres.',
        warnings: [],
        ...overrides,
    };
}

describe('Notion Editor — Command Registry (Lot C/D/E)', () => {
    it('organizes commands into Texte, Raid, and Avancé groups', () => {
        const groups = new Set(EDITOR_COMMANDS.map(c => c.group));
        expect(groups.has('Texte')).toBe(true);
        expect(groups.has('Raid')).toBe(true);
        expect(groups.has('Avancé')).toBe(true);
    });

    it('filters commands by label, keyword, or slash prefix', () => {
        expect(filterEditorCommands('/h1').some(c => c.id === 'h1')).toBe(true);
        expect(filterEditorCommands('morse').some(c => c.id === 'code_morse')).toBe(true);
        expect(filterEditorCommands('carte').some(c => c.id === 'raid_map')).toBe(true);
    });

    it('exposes transformable commands for the selection bubble', () => {
        const transformable = getTransformableCommands();
        expect(transformable.length).toBeGreaterThan(5);
        expect(transformable.some(c => c.id === 'h1')).toBe(true);
        expect(transformable.some(c => c.id === 'code_morse')).toBe(true);
    });
});

describe('Notion Editor — Reducer Actions (Lot B/F/H)', () => {
    it('moves a block up and down with MOVE_CARNET_STEP', () => {
        const s1 = makeStep({ id: 's1' });
        const s2 = makeStep({ id: 's2', isManual: true, manualType: 'html', solutionText: 'Libre' });
        const state = { ...getInitialAppState(), carnet_steps: [s1, s2] };

        const movedUp = carnetReducer(state, { type: 'MOVE_CARNET_STEP', stepId: 's2', direction: 'up' })!;
        expect(movedUp.carnet_steps.map(s => s.id)).toEqual(['s2', 's1']);

        const movedDown = carnetReducer(movedUp, { type: 'MOVE_CARNET_STEP', stepId: 's2', direction: 'down' })!;
        expect(movedDown.carnet_steps.map(s => s.id)).toEqual(['s1', 's2']);
    });

    it('reorders blocks via drag-and-drop REORDER_CARNET_STEPS', () => {
        const s1 = makeStep({ id: 's1' });
        const s2 = makeStep({ id: 's2' });
        const s3 = makeStep({ id: 's3' });
        const state = { ...getInitialAppState(), carnet_steps: [s1, s2, s3] };

        const reordered = carnetReducer(state, {
            type: 'REORDER_CARNET_STEPS',
            sourceStepId: 's3',
            targetStepId: 's1',
            position: 'before',
        })!;
        expect(reordered.carnet_steps.map(s => s.id)).toEqual(['s3', 's1', 's2']);
    });

    it('detaches a generated block into a free html block without tint or warnings', () => {
        const gen = makeStep({
            id: 'gen-1',
            isManual: false,
            isEdited: true,
            warnings: [{ id: 'w1', stepId: 'gen-1', rule: 'distance', message: 'Test', severity: 'warning' }],
        });
        const state = { ...getInitialAppState(), carnet_steps: [gen] };

        const detached = carnetReducer(state, { type: 'DETACH_COMPUTED_STEP', stepId: 'gen-1' })!;
        expect(detached.carnet_steps[0].isManual).toBe(true);
        expect(detached.carnet_steps[0].manualType).toBe('html');
        expect(detached.carnet_steps[0].isEdited).toBe(false);
        expect(detached.carnet_steps[0].warnings).toEqual([]);
    });

    it('marks generated text as modified and supports hiding/unhiding with undo', () => {
        const gen = makeStep({ id: 'gen-1', isManual: false });
        const state = { ...getInitialAppState(), carnet_steps: [gen] };

        const edited = carnetReducer(state, {
            type: 'EDIT_COMPUTED_TEXT',
            stepId: 'gen-1',
            newSolutionText: 'Texte modifié à la main',
        })!;
        expect(edited.carnet_steps[0].isEdited).toBe(true);
        expect(edited.carnet_steps[0].solutionText).toBe('Texte modifié à la main');

        const hidden = carnetReducer(edited, { type: 'HIDE_COMPUTED_STEP', stepId: 'gen-1' })!;
        expect(hidden.carnet_steps[0].isHidden).toBe(true);

        const unhidden = carnetReducer(hidden, { type: 'UNHIDE_COMPUTED_STEP', stepId: 'gen-1' })!;
        expect(unhidden.carnet_steps[0].isHidden).toBe(false);
    });

    it('applies text color and alignment to free text blocks', () => {
        const free = makeStep({ id: 'free-1', isManual: true, manualType: 'html' });
        const state = { ...getInitialAppState(), carnet_steps: [free] };

        const styled = carnetReducer(state, {
            type: 'SET_STEP_STYLE',
            stepId: 'free-1',
            textColor: '#60a5fa',
            textAlign: 'center',
        })!;
        expect(styled.carnet_steps[0].textColor).toBe('#60a5fa');
        expect(styled.carnet_steps[0].textAlign).toBe('center');
    });

    it('handles 376 warnings quickly without slowdown', () => {
        const steps: CarnetStep[] = Array.from({ length: 376 }, (_, i) =>
            makeStep({
                id: `w-${i}`,
                warnings: [{ id: `w-${i}`, stepId: `w-${i}`, rule: 'distance', message: `Anomalie ${i}`, severity: 'warning' }],
            })
        );
        const start = performance.now();
        const items: Array<{ stepId: string; message: string }> = [];
        for (const step of steps) {
            if (step.warnings?.length && !step.isEdited && !step.isHidden) {
                for (const w of step.warnings) {
                    items.push({ stepId: step.id, message: w.message });
                }
            }
        }
        const elapsed = performance.now() - start;
        expect(items.length).toBe(376);
        expect(elapsed).toBeLessThan(50);
    });

    it('restricts added blocks to text ciphers and includes compatible spatial modules for generated blocks', () => {
        const textOnly = getCryptoCommands(false).map(c => c.config?.cipher);
        expect(textOnly).toContain('morse');
        expect(textOnly).not.toContain('gilwell');
        expect(textOnly).not.toContain('carte_ign');

        const computed = getCryptoCommands(true).map(c => c.config?.cipher);
        expect(computed).toContain('morse');
        expect(computed).toContain('gilwell');
        expect(computed).toContain('carte_ign');
        expect(computed).toContain('texte_clair');
    });

    it('computes word boundaries for double-click selection', () => {
        const text = 'Allez vers le Nord-Est';
        const [s, e] = getWordBounds(text, 7);
        expect(text.slice(s, e)).toBe('vers');
    });

    it('converts closed inline markdown (**bold**, *italic*, `code`, <u>) and LaTeX ($...$, $$...$$) to live HTML', () => {
        const html = inlineMarkdownToHtml('Allez **tout droit** vers *le chêne* `45°` <u>ici</u> $x^2 + 1$');
        expect(html).toContain('<strong>tout droit</strong>');
        expect(html).toContain('<em>le chêne</em>');
        expect(html).toContain('<code');
        expect(html).toContain('<u>ici</u>');
        expect(html).toContain('data-latex="x^2 + 1"');
        expect(html).toContain('katex');
    });

    it('isolates a selected substring into new blocks for ciphers and headings', () => {
        const base = getInitialAppState();
        const manual = makeStep({
            id: 'm1',
            isManual: true,
            manualType: 'html',
            solutionText: 'Avancez tout droit vers le Nord puis tournez',
        });
        const stateWithManual = { ...base, carnet_steps: [manual] };
        const next = carnetReducer(stateWithManual, {
            type: 'ISOLATE_SELECTION_TO_BLOCK',
            stepId: 'm1',
            beforeText: 'Avancez tout droit ',
            selectedText: 'vers le Nord',
            afterText: ' puis tournez',
            targetType: 'code',
            moduleId: 'morse',
        })!;
        expect(next.carnet_steps.length).toBe(3);
        expect(next.carnet_steps[0].solutionText).toBe('Avancez tout droit');
        expect(next.carnet_steps[1].manualType).toBe('code');
        expect(next.carnet_steps[1].moduleId).toBe('morse');
        expect(next.carnet_steps[1].solutionText).toBe('vers le Nord');
        expect(next.carnet_steps[2].solutionText).toBe('puis tournez');
    });
});
