import { NavigationText } from './NavigationText';
import { ModuleLogic } from './ModuleLogic';
import { ModuleRegistry, MODULE_META } from './ModuleRegistry';
import { themeManager } from './ThemeManager';
import { ConstraintChecker } from './ConstraintChecker';
import type { CarnetStep, PolySegment, PresetData, PathPlanEntry, ThemeData } from './types';

export class CarnetEngine {
    
    /**
     * Compute a step LIVE during editing.
     * Takes raw poly-segments and the orchestrator's module assignment.
     */
    static computeStepContent(
        stepId: string,
        fromLabel: string,
        toLabel: string,
        moduleId: string,
        segments: PolySegment[],
        activePreset: PresetData | null,
        globalSegments: PolySegment[] = segments,
        startIdx: number = 0
    ): CarnetStep {
        // Calculate totals
        const totalDist = segments.reduce((acc, s) => acc + (s.distance || 0), 0);
        // Take the first segment's azimut or an average
        const initialAzimut = segments[0]?.azimut || 0;
        const coords = segments.flatMap(s => s.coords || []);

        const theme = themeManager.getTheme();

        // 1. Navigation Text
        // Provide the live navigation sentence based on theme FOR EACH SEGMENT
        const navTexts = segments.map((seg, i) => {
            const globalIdx = startIdx + i;
            const prevAzimuth = globalIdx > 0 ? globalSegments[globalIdx - 1].azimut : undefined;
            return NavigationText.generate(seg.distance || 0, seg.azimut || 0, seg.poi || null, theme, prevAzimuth);
        });
        const navText = navTexts.join('\n');

        // 2. Encoding
        const encodedTexts = navTexts.map(text => ModuleLogic.encode(moduleId, text, { key: theme.vigenere_key }));
        const encodedText = encodedTexts.join('\n');

        // 3. Constraints (single step check context)
        // Global constraint checker will run at the app level, but here we can populate defaults
        let warnings: any[] = [];

        // 4. Gilwell SVG (live computation if module is gilwell)
        let gilwellSvg = undefined;
        if (moduleId === 'gilwell') {
            gilwellSvg = ModuleLogic.generateGilwellSVG(segments);
        }

        // 5. Build step object
        return {
            id: stepId,
            fromLabel,
            toLabel,
            moduleId: moduleId as any,
            distanceM: totalDist,
            azimuth: initialAzimut,
            coords: coords as any,
            solutionText: navText,
            encodedText: encodedText,
            warnings: warnings,
            gilwellSvg: gilwellSvg,
            annexes: MODULE_META[moduleId as keyof typeof MODULE_META]?.defaultAnnexes as any[] || [],
        };
    }

    /**
     * Merge adjacent segments of the same module into single steps.
     * Called when generating the textual view from the Orchestrator's plan.
     */
    static generateStepsFromPlan(
        plan: PathPlanEntry[],
        segments: PolySegment[],
        stages: { id: string; coords: [number, number]; label: string }[],
        activePreset: PresetData | null
    ): CarnetStep[] {
        const steps: CarnetStep[] = [];
        
        for (let i = 0; i < plan.length; i++) {
            const [moduleId, startIdx, count] = plan[i];
            const groupSegments = segments.slice(startIdx, startIdx + count);
            
            let fromLabel = '';
            let toLabel = '';
            
            const cStart = groupSegments[0]?.coords[0];
            const cEnd = groupSegments[groupSegments.length - 1]?.coords.slice(-1)[0];
            
            if (cStart) {
                fromLabel = stages.find(st => Math.abs(st.coords[0] - cStart[1]) < 0.001 && Math.abs(st.coords[1] - cStart[0]) < 0.001)?.label || '';
            }
            if (cEnd) {
                toLabel = stages.find(st => Math.abs(st.coords[0] - cEnd[1]) < 0.001 && Math.abs(st.coords[1] - cEnd[0]) < 0.001)?.label || '';
            }

            // toLabel is only relevant for the very last step of the entire carnet
            if (startIdx + count === segments.length && stages.length > 0) {
                toLabel = stages[stages.length - 1].label;
            }

            const step = this.computeStepContent(
                `step-${i}`,
                fromLabel,
                toLabel,
                moduleId,
                groupSegments,
                activePreset,
                segments,
                startIdx
            );
            step.segmentIndices = [];
            for (let j = 0; j < count; j++) step.segmentIndices.push(startIdx + j);
            steps.push(step);
        }

        // Run global constraints over the generated steps
        // This requires mapping them back to segments, so we rely on the app-level state 
        // to assign the warnings to the steps.
        
        return steps;
    }

    /**
     * REFORGED HTML EXPORT generating a premium HTML document.
     * Takes fully computed steps (which contain interactive map info, live svg, etc).
     * Output matches PDF quality.
     */
    static generateExportHTML(
        steps: CarnetStep[],
        theme: ThemeData,
        projectInfo: { name: string; date: string; address?: string }
    ): string {
        const title = theme.labels?.main_title || 'CARNET DE ROUTE';

        // Base styles
        let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${projectInfo.name || 'Carnet'}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@300;400;600&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Kalam:wght@400;700&display=swap');
        
        :root {
            --accent: #2d5a27;
            --bg: #ffffff;
            --text-main: #1f2937;
        }

        @page {
            size: A4;
            margin: 20mm;
            @bottom-center {
                content: counter(page);
                font-family: 'Inter', sans-serif;
                font-size: 10pt;
                color: #666;
            }
        }

        body {
            font-family: 'Inter', sans-serif;
            color: var(--text-main);
            background: var(--bg);
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.5;
        }

        h1, h2, h3 { font-family: 'Cinzel', serif; color: var(--accent); }
        h1 { font-size: 32pt; text-align: center; margin-bottom: 5mm; }
        
        .cover {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            page-break-after: always;
        }

        .cover-title { font-size: 48pt; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
        .cover-subtitle { font-size: 18pt; color: #4b5563; }
        .cover-date { margin-top: 40px; font-size: 12pt; font-style: italic; }

        .step-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            page-break-inside: avoid;
            background: #f9fafb;
        }
        
        .step-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid var(--accent);
            padding-bottom: 5px;
            margin-bottom: 15px;
            font-weight: bold;
            font-size: 12pt;
        }

        .step-content {
            font-size: 12pt;
        }

        /* Module Specific Typo */
        .font-morse { font-family: 'Courier Prime', monospace; font-size: 14pt; letter-spacing: 2px; }
        .font-vigenere { font-family: 'Courier Prime', monospace; font-size: 13pt; background: #e5e7eb; padding: 5px; }
        .font-cassis { font-family: 'Kalam', cursive; font-size: 16pt; }
        
        /* Map container for export logic */
        .leaflet-map-snapshot {
            width: 100%;
            height: 300px;
            background: #e2e8f0;
            border-radius: 4px;
            margin-bottom: 10px;
            border: 1px solid #ccc;
        }

        .svg-container {
            text-align: center;
            margin: 15px 0;
        }

        /* Annexes */
        .annexe-page { page-break-before: always; }
        table.polybe-grid { border-collapse: collapse; margin: 20px auto; }
        table.polybe-grid td, table.polybe-grid th { border: 1px solid #333; padding: 10px 15px; text-align: center; }
        table.polybe-grid th { background: #f3f4f6; }
    </style>
</head>
<body>
`;

        // Cover Page
        html += `
<div class="cover">
    <div class="cover-title">${title}</div>
    <div class="cover-subtitle">${projectInfo.name || 'Projet Sans Titre'}</div>
    ${projectInfo.address ? `<div class="cover-address">Point de départ: ${projectInfo.address}</div>` : ''}
    <div class="cover-date">${projectInfo.date || new Date().toLocaleDateString('fr-FR')}</div>
</div>
`;

        // Steps
        let stepCount = 1;
        for (const step of steps) {
            
            // Gather map data if necessary. HTML will be injected with actual map snapshots via Canvas before print.
            let visualContent = '';
            if (step.moduleId === 'gilwell' && step.gilwellSvg) {
                visualContent = `<div class="svg-container">${step.gilwellSvg}</div>`;
            } else if (['carte_ign', 'drapeaux'].includes(step.moduleId)) {
                visualContent = `<div class="leaflet-map-snapshot" data-center="${step.mapCenter}" data-zoom="${step.mapZoom}">[Ceci sera remplacé par une image de la carte avant l'impression]</div>`;
            }

            // Typography assignment
            let textColorClass = '';
            if (step.moduleId === 'morse') textColorClass = 'font-morse';
            else if (step.moduleId === 'vigenere') textColorClass = 'font-vigenere';
            else if (step.moduleId === 'cassis' || step.moduleId === 'avocat') textColorClass = 'font-cassis';

            html += `
<div class="step-card">
    <div class="step-header">
        <span>Étape ${stepCount} ${step.fromLabel ? `(${step.fromLabel})` : ''}</span>
        <span style="color:#666; font-size:10pt; font-weight:normal;">${ModuleRegistry.getMeta(step.moduleId)?.label || step.moduleId}</span>
    </div>
    <div class="step-content ${textColorClass}">
        ${step.solutionText ? `<div style="display:none;" class="solution-hint">${step.solutionText}</div>` : ''}
        ${visualContent}
        ${!['carte_ign', 'gilwell'].includes(step.moduleId) ? `<div>${step.encodedText.replace(/\\n/g, '<br>')}</div>` : ''}
    </div>
</div>
`;
            stepCount++;
        }

        // Global Annexes Gather
        const annexesSet = new Set<string>();
        steps.forEach(s => s.annexes?.forEach(a => annexesSet.add(a)));

        if (annexesSet.has('grille_polybe')) {
            html += `<div class="annexe-page"><h2>${theme.labels?.polybe_label || 'Carré de Polybe'}</h2>`;
            const grid = ModuleLogic.getPolybeGrid();
            html += `<table class="polybe-grid"><tr><th></th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr>`;
            for(let r=0; r<6; r++) {
                html += `<tr><th>${r+1}</th>`;
                for(let c=0; c<6; c++) {
                    html += `<td>${grid[r][c].char}</td>`;
                }
                html += `</tr>`;
            }
            html += `</table></div>`;
        }
        
        // Add other annexes...

        html += `
</body>
</html>`;
        return html;
    }
}
