# app/api/export.py - Routes d'export PDF / .srproj
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi.responses import StreamingResponse
import uuid
import json

from app.database import get_db
from app.models.document import Document, Asset
from app.services.pdf_generator import pdf_generator
from app.services.archive import archive_service
from app.api.auth import get_current_user_dependency
from app.schemas.document import ExportOptions
from app.models.user import User

router = APIRouter(prefix="/documents", tags=["export"])


@router.post("/{document_id}/export/pdf")
async def export_pdf(
    document_id: uuid.UUID,
    options: ExportOptions = ExportOptions(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Exporte un document en PDF via WeasyPrint."""
    # Récupérer document avec assets
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.assets))
        .where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Vérifier permissions
    if document.owner_id != current_user.id:
        from app.models.document import ShareLink
        share_result = await db.execute(
            select(ShareLink).where(
                ShareLink.document_id == document_id,
                ShareLink.is_revoked == False
            )
        )
        if not share_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Accès refusé")

    # Construire le HTML depuis le JSON du document
    html = build_export_html(document, options.version)

    # Générer le PDF
    try:
        margins = document.page_layout.get("margins", {})
        pdf_bytes = pdf_generator.generate_pdf(
            html_content=html,
            page_size=document.page_layout.get("format", "A4"),
            margins=margins,
            extra_css=build_export_css(document)
        )

        filename = f"{document.title.replace(' ', '_')}_{options.version}.pdf"
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération PDF: {e}")


@router.get("/{document_id}/export/srproj")
async def export_srproj(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Exporte un document en archive .srproj (ZIP)."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.assets))
        .where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut exporter")

    # Préparer les assets pour l'archive
    assets = {}
    for asset in document.assets:
        try:
            asset_data = await garage_client.download_asset(asset.asset_id, asset.asset_type)
            assets[asset.asset_id] = asset_data
        except FileNotFoundError:
            # Asset manquant sur S3 - on continue sans
            pass

    # Créer l'archive
    try:
        manifest = document.json_data
        # S'assurer que le manifest a les bons IDs
        manifest["id"] = str(document.id)
        manifest["title"] = document.title

        zip_data = archive_service.create_srproj(manifest, assets)

        filename = f"{document.title.replace(' ', '_')}.srproj"
        return StreamingResponse(
            iter([zip_data]),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création archive: {e}")


# Import garage_client pour l'export
from app.services.s3_client import garage_client


def build_export_html(document: Document, version: str = "participant") -> str:
    """Construit le HTML complet pour l'export depuis le JSON v2.0."""
    manifest = document.json_data
    blocks = manifest.get("blocks", [])
    assets = manifest.get("assets", {})
    page_layout = manifest.get("pageLayout", document.page_layout)

    # CSS inline pour l'export
    css = build_export_css(document)

    # Générer le contenu des blocs
    blocks_html = []
    for block in blocks:
        block_html = render_block_for_export(block, assets, version)
        if block_html:
            blocks_html.append(block_html)

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>{manifest.get('title', 'Document')} - {version.capitalize()}</title>
    <style>{css}</style>
</head>
<body>
    <div class="document">
        {''.join(blocks_html)}
    </div>
</body>
</html>"""
    return html


def build_export_css(document: Document) -> str:
    """Génère le CSS pour l'export PDF."""
    page_layout = document.page_layout
    margins = page_layout.get("margins", {"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"})

    # Polices intégrées (base64 sera injecté côté frontend)
    font_faces = """
    @font-face { font-family: 'Morse'; src: url('data:font/woff2;base64,') format('woff2'); }
    @font-face { font-family: 'TemplarsCipherPlus'; src: url('data:font/woff2;base64,') format('woff2'); }
    @font-face { font-family: 'Maritime'; src: url('data:font/woff2;base64,') format('woff2'); }
    """

    return f"""
    {font_faces}

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    @page {{
        size: {page_layout.get('format', 'A4')};
        margin-top: {margins.get('top', '20mm')};
        margin-bottom: {margins.get('bottom', '20mm')};
        margin-left: {margins.get('left', '15mm')};
        margin-right: {margins.get('right', '15mm')};

        @top-left {{ content: string(doctitle); font-size: 8pt; color: #666; border-bottom: 1pt solid #ccc; padding-bottom: 2mm; }}
        @top-right {{ content: string(versiontitle); font-size: 8pt; color: #666; border-bottom: 1pt solid #ccc; padding-bottom: 2mm; }}
        @bottom-center {{ content: counter(page) " / " counter(pages); font-size: 8pt; color: #999; border-top: 0.5pt solid #ccc; padding-top: 2mm; }}
    }}

    .title-page {{ string-set: doctitle content(); }}
    .version-marker {{ string-set: versiontitle content(); }}

    body {{
        font-family: system-ui, sans-serif;
        font-size: 11pt;
        line-height: 1.5;
        color: #111;
        background: white;
    }}

    .document {{ max-width: 100%; }}

    .block {{ margin: 12px 0; page-break-inside: avoid; }}

    .block-title_page {{ min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-before: always; page-break-after: always; }}
    .block-title_page h1 {{ font-size: 36pt; font-weight: 700; margin-bottom: 16px; }}
    .block-title_page .subtitle {{ font-size: 16pt; color: #555; margin-bottom: 32px; }}

    .block-rich_text .paragraph {{ margin-bottom: 8px; }}
    .block-rich_text .heading {{ font-weight: 700; margin: 16px 0 8px; }}
    .block-rich_text h1 {{ font-size: 18pt; }}
    .block-rich_text h2 {{ font-size: 14pt; }}
    .block-rich_text h3 {{ font-size: 12pt; }}

    .block-crypto_block {{
        border-left: 3px solid #8b5cf6;
        background: #f5f0ff;
        padding: 12px 16px;
        margin: 8px 0;
        font-family: 'Courier New', monospace;
        font-size: 13pt;
        line-height: 1.6;
    }}
    .block-crypto_block[data-cipher="morse"] {{ border-color: #ef4444; background: #fef2f2; font-family: 'Morse', monospace; font-size: 15pt; letter-spacing: 0.12em; }}
    .block-crypto_block[data-cipher="templier"] {{ border-color: #f59e0b; background: #fffbeb; font-family: 'TemplarsCipherPlus', serif; font-size: 15pt; }}

    .block-map_snippet {{ text-align: center; margin: 16px 0; }}
    .block-map_snippet .map-label {{ font-size: 10pt; font-family: monospace; color: #666; margin-bottom: 6px; }}
    .block-map_snippet svg {{ border: 2px solid #1e293b; border-radius: 4px; max-width: 100%; }}

    .block-annexe {{ break-before: page; margin-top: 32px; padding-top: 16px; border-top: 2px solid #333; }}
    .block-annexe h2 {{ font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px; }}
    .block-annexe table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; }}
    .block-annexe th, .block-annexe td {{ border: 1px solid #ccc; padding: 4px 6px; text-align: center; }}

    .block-route_table {{ overflow-x: auto; margin: 16px 0; }}
    .block-route_table table {{ width: 100%; border-collapse: collapse; font-size: 9.5pt; font-family: monospace; }}
    .block-route_table th {{ background: #f5f5f5; border-bottom: 2px solid #333; padding: 6px 8px; font-weight: 700; }}
    .block-route_table td {{ padding: 4px 8px; border-bottom: 1px solid #eee; }}

    .page-break {{ break-before: page; }}

    img {{ max-width: 100%; height: auto; border-radius: 4px; }}
    """


def render_block_for_export(block: dict, assets: dict, version: str) -> str:
    """Rend un bloc individuel en HTML pour l'export."""
    block_type = block.get("type")
    config = block.get("config", {})
    locked = block.get("locked", False)

    if block_type == "title_page":
        config = config or {}
        return f"""
        <div class="block block-title_page" data-block-id="{block.get('id')}">
            {f'<img src="data:image/png;base64,{config.get("logoAssetId")}" alt="Logo" style="width:100px;height:100px;margin-bottom:24px;">' if config.get("logoAssetId") else ''}
            <h1>{config.get("title", "Document")}</h1>
            {f'<p class="subtitle">{config.get("subtitle")}</p>' if config.get("subtitle") else ''}
            <div style="margin-top:auto;padding-top:24px;border-top:1px solid #ccc;font-size:12pt;color:#666;">
                {f'Auteur: {config.get("author")}<br>' if config.get("author") else ''}
                {f'Date: {config.get("date")}' if config.get("date") else ''}
            </div>
        </div>
        """

    elif block_type == "rich_text":
        content = config.get("content", [])
        html_parts = []
        for item in content:
            if item.get("type") == "paragraph":
                html_parts.append(f'<p class="paragraph">{item.get("text", "")}</p>')
            elif item.get("type") == "heading":
                level = item.get("level", 1)
                html_parts.append(f'<h{level} class="heading">{item.get("text", "")}</h{level}>')
            elif item.get("type") == "inline_image":
                asset_id = item.get("assetId")
                width = item.get("widthPercent", 100)
                align = item.get("align", "center")
                # L'image sera une data URI injectée par le frontend
                html_parts.append(f'<div style="text-align:{align}; margin:8px 0;"><img src="cid:{asset_id}" style="width:{width}%;max-width:100%;" alt=""></div>')
        return f'<div class="block block-rich_text" data-block-id="{block.get("id")}">{"".join(html_parts)}</div>'

    elif block_type == "crypto_block":
        cipher = config.get("cipher", "vigenere")
        rendered = config.get("renderedText", "") if version == "participant" else config.get("sourceText", "")
        cipher_colors = {
            "morse": "#ef4444", "vigenere": "#8b5cf6", "polybe": "#06b6d4",
            "templier": "#f59e0b", "maritime": "#3b82f6", "avocat": "#3b82f6", "cassis": "#ec4899"
        }
        color = cipher_colors.get(cipher, "#6b7280")
        font_class = {
            "morse": "Morse", "templier": "TemplarsCipherPlus", "maritime": "Maritime"
        }.get(cipher, "Courier New")

        return f"""
        <div class="block block-crypto_block" data-block-id="{block.get('id')}" data-cipher="{cipher}" style="border-left-color:{color};background:{color}15;font-family:'{font_class}',monospace;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:10px;color:#666;">
                <span style="width:8px;height:8px;border-radius:50%;background:{color};"></span>
                <strong style="text-transform:uppercase;letter-spacing:0.05em;color:{color};">{cipher.upper()}</strong>
            </div>
            <div style="word-break:break-all;white-space:pre-wrap;">{rendered}</div>
        </div>
        """

    elif block_type == "map_snippet":
        # Placeholder pour la carte (le frontend injecte le SVG)
        return f"""
        <div class="block block-map_snippet" data-block-id="{block.get('id')}">
            <div class="map-label">EXTRAIT CARTOGRAPHIQUE ({config.get('scaleName', '1:25000')})</div>
            <div class="map-placeholder" data-asset-id="{config.get('assetId', '')}" style="background:#e2e8f0;border:2px solid #1e293b;border-radius:4px;min-height:300px;display:flex;align-items:center;justify-content:center;color:#666;font-family:monospace;">
                Carte: {config.get('scaleName', '1:25000')}
            </div>
        </div>
        """

    elif block_type == "annexe":
        return f"""
        <div class="block block-annexe" data-block-id="{block.get('id')}">
            <h2>{config.get('title', 'Annexe')}</h2>
            <div>{config.get('content', '')}</div>
        </div>
        """

    elif block_type == "route_table":
        columns = config.get("columns", [])
        rows = config.get("rows", [])
        col_labels = {"step": "Étape", "azimuth": "Azimut (°)", "distance": "Dist. (m)", "module": "Module", "pois": "POIs", "cumulative": "Cumul (m)"}

        thead = "".join(f"<th>{col_labels.get(c, c)}</th>" for c in columns)
        tbody = ""
        for row in rows:
            tbody += "<tr>" + "".join(f"<td>{row.get(c, '')}</td>" for c in columns) + "</tr>"

        return f"""
        <div class="block block-route_table" data-block-id="{block.get('id')}">
            <table>
                <thead><tr>{thead}</tr></thead>
                <tbody>{tbody}</tbody>
            </table>
        </div>
        """

    elif block_type == "page_break":
        return '<div class="page-break"></div>'

    return ""