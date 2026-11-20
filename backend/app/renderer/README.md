# renderer

## Overview
Server-side document and map rendering engine compiling HTML and SVG templates.

## Interface
- `[inspector.py] class PageMetric`
- `[inspector.py] class InspectionReport`
- `[inspector.py] class PDFLayoutInspector`
- `[inspector.py]   PDFLayoutInspector.inspect()`
- `[models.py] class PageOrientation`
- `[models.py] class PageFormat`
- `[models.py] class CarnetRenderOptions`
- `[models.py] class StepRenderBlock`
- `[service.py] class WeasyPrintRenderService`
- `[service.py]   WeasyPrintRenderService.__init__()`
- `[service.py]   WeasyPrintRenderService.load_css()`
- `[service.py]   WeasyPrintRenderService.render_html()`
- `[service.py]   WeasyPrintRenderService.compile_pdf()`
- `[service.py]   WeasyPrintRenderService.generate_carnet()`

## Invariants
- [inspector.py] assert len(reader.pages) == total_pages

## Side Effects
- Filesystem operations (file read/write)

## Verification
- Run: `pytest tests/ -v`
