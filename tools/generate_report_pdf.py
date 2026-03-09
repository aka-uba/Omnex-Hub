# -*- coding: utf-8 -*-
"""
Omnex Display Hub - Proje Değerlendirme Raporu PDF Generator
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
from datetime import datetime

# --- Colors ---
PRIMARY = HexColor('#228be6')
PRIMARY_DARK = HexColor('#1971c2')
PRIMARY_LIGHT = HexColor('#e7f5ff')
SUCCESS = HexColor('#40c057')
SUCCESS_LIGHT = HexColor('#ebfbee')
WARNING = HexColor('#fab005')
WARNING_LIGHT = HexColor('#fff9db')
DANGER = HexColor('#fa5252')
GRAY_50 = HexColor('#f8f9fa')
GRAY_100 = HexColor('#f1f3f5')
GRAY_200 = HexColor('#e9ecef')
GRAY_500 = HexColor('#adb5bd')
GRAY_700 = HexColor('#495057')
GRAY_800 = HexColor('#343a40')
GRAY_900 = HexColor('#212529')
WHITE = white
BLACK = black

# --- Output ---
OUTPUT_DIR = r"C:\xampp\htdocs\market-etiket-sistemi"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "Omnex_Display_Hub_Proje_Degerlendirme_Raporu.pdf")

# --- Styles ---
styles = getSampleStyleSheet()

style_title = ParagraphStyle('CustomTitle', parent=styles['Title'],
    fontSize=24, leading=30, textColor=PRIMARY_DARK, spaceAfter=6,
    alignment=TA_LEFT)

style_subtitle = ParagraphStyle('CustomSubtitle', parent=styles['Normal'],
    fontSize=11, leading=14, textColor=GRAY_700, spaceAfter=20,
    alignment=TA_LEFT)

style_h1 = ParagraphStyle('H1', parent=styles['Heading1'],
    fontSize=16, leading=20, textColor=PRIMARY_DARK, spaceBefore=16,
    spaceAfter=10, borderWidth=0)

style_h2 = ParagraphStyle('H2', parent=styles['Heading2'],
    fontSize=13, leading=16, textColor=GRAY_800, spaceBefore=12,
    spaceAfter=8)

style_body = ParagraphStyle('Body', parent=styles['Normal'],
    fontSize=9.5, leading=13, textColor=GRAY_800, spaceAfter=6)

style_small = ParagraphStyle('Small', parent=styles['Normal'],
    fontSize=8, leading=10, textColor=GRAY_500, spaceAfter=4)

style_note = ParagraphStyle('Note', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=GRAY_700, spaceAfter=8,
    leftIndent=10, borderPadding=6)

style_cell = ParagraphStyle('Cell', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=GRAY_800)

style_cell_bold = ParagraphStyle('CellBold', parent=style_cell,
    fontName='Helvetica-Bold', textColor=GRAY_900)

style_cell_center = ParagraphStyle('CellCenter', parent=style_cell,
    alignment=TA_CENTER)

style_cell_right = ParagraphStyle('CellRight', parent=style_cell,
    alignment=TA_RIGHT)

style_cell_right_bold = ParagraphStyle('CellRightBold', parent=style_cell_right,
    fontName='Helvetica-Bold', textColor=GRAY_900)

style_header_cell = ParagraphStyle('HeaderCell', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=WHITE, fontName='Helvetica-Bold',
    alignment=TA_LEFT)

style_header_center = ParagraphStyle('HeaderCenter', parent=style_header_cell,
    alignment=TA_CENTER)

style_header_right = ParagraphStyle('HeaderRight', parent=style_header_cell,
    alignment=TA_RIGHT)

style_summary = ParagraphStyle('Summary', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=GRAY_800, spaceAfter=10,
    borderColor=PRIMARY, borderWidth=1, borderPadding=10,
    backColor=PRIMARY_LIGHT)


def P(text, style=style_cell):
    return Paragraph(str(text), style)


def make_table(headers, rows, col_widths=None, header_styles=None):
    """Create a styled table with header row."""
    if header_styles is None:
        header_styles = [style_header_cell] * len(headers)

    data = [[P(h, header_styles[i]) for i, h in enumerate(headers)]]

    for row in rows:
        data.append(row)

    available = 170 * mm
    if col_widths is None:
        col_widths = [available / len(headers)] * len(headers)

    t = Table(data, colWidths=col_widths, repeatRows=1)

    base_style = [
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_200),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, PRIMARY_DARK),
    ]

    for i in range(1, len(data)):
        if i % 2 == 0:
            base_style.append(('BACKGROUND', (0, i), (-1, i), GRAY_50))

    t.setStyle(TableStyle(base_style))
    return t


def section_divider():
    """Thin colored line divider."""
    t = Table([['']],  colWidths=[170 * mm], rowHeights=[2])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY),
        ('LINEBELOW', (0, 0), (-1, -1), 0, WHITE),
    ]))
    return t


def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title="Omnex Display Hub - Proje Degerlendirme Raporu",
        author="Claude AI Analysis",
        subject="Project Valuation Report"
    )

    story = []
    W = 170 * mm  # available width

    # ============================================================
    # COVER / HEADER
    # ============================================================
    story.append(Spacer(1, 15 * mm))

    # Logo-like header bar
    header_data = [[
        P("OMNEX DISPLAY HUB", ParagraphStyle('Logo', parent=style_header_cell,
            fontSize=20, leading=26)),
    ]]
    ht = Table(header_data, colWidths=[W], rowHeights=[18 * mm])
    ht.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY_DARK),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    story.append(ht)
    story.append(Spacer(1, 8 * mm))

    story.append(P("Proje Degerlendirme Raporu", style_title))
    story.append(P(
        f"ESL &amp; Digital Signage Yonetim Platformu  |  "
        f"Rapor Tarihi: {datetime.now().strftime('%d.%m.%Y')}",
        style_subtitle))

    story.append(section_divider())
    story.append(Spacer(1, 4 * mm))

    # Quick summary
    story.append(P(
        "<b>Ozet:</b> 216.000 satirlik bu proje, 1 kidemli gelistiricinin 14-18 aylik tam zamanli "
        "calismasina esdeger. Sifirdan yaptirilmasi <b>3-5M TL</b>, bir SaaS'a donusturulmesi "
        "halinde 100 musteriyle <b>30M+ TL</b> degerleme potansiyeli tasiyor. ESL + Digital Signage "
        "nis pazarinda Turkiye'de dogrudan rakibi olmayan, 8 dilli, multi-tenant, production-ready "
        "bir platform.", style_summary))

    story.append(Spacer(1, 6 * mm))

    # ============================================================
    # 1. KOD TABANI ISTATISTIKLERI
    # ============================================================
    story.append(P("1. Kod Tabani Istatistikleri", style_h1))

    headers = ['Kategori', 'Dosya Sayisi', 'Satir Sayisi']
    h_styles = [style_header_cell, style_header_center, style_header_right]
    rows = [
        [P('PHP (Backend)', style_cell_bold), P('381', style_cell_center), P('57.575', style_cell_right)],
        [P('JavaScript (Frontend)', style_cell_bold), P('141', style_cell_center), P('102.047', style_cell_right)],
        [P('CSS (Stiller)', style_cell_bold), P('44', style_cell_center), P('48.949', style_cell_right)],
        [P('SQL (Veritabani)', style_cell_bold), P('141', style_cell_center), P('7.455', style_cell_right)],
        [P('Locale JSON (8 dil)', style_cell_bold), P('160', style_cell_center), P('8.114', style_cell_right)],
        [P('Seed Data JSON', style_cell_bold), P('60', style_cell_center), P('189.828', style_cell_right)],
        [P('HTML', style_cell_bold), P('6', style_cell_center), P('654', style_cell_right)],
        [P('Docs / MD', style_cell_bold), P('~20', style_cell_center), P('50.094', style_cell_right)],
        [P('Config / Docker', style_cell_bold), P('~15', style_cell_center), P('1.190', style_cell_right)],
        [P('TOPLAM KOD', ParagraphStyle('t', parent=style_cell_bold, textColor=PRIMARY_DARK)),
         P('~968', ParagraphStyle('t', parent=style_cell_center, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)),
         P('~466.000', ParagraphStyle('t', parent=style_cell_right, fontName='Helvetica-Bold', textColor=PRIMARY_DARK))],
    ]
    story.append(make_table(headers, rows, [W * 0.50, W * 0.22, W * 0.28], h_styles))
    story.append(Spacer(1, 2 * mm))
    story.append(P("Seed data (189K) ve docs (50K) haric saf uygulama kodu: ~216.000 satir", style_note))

    # ============================================================
    # 2. MIMARI KARMASIKLIK
    # ============================================================
    story.append(P("2. Mimari Karmasiklik", style_h1))

    headers2 = ['Metrik', 'Deger']
    h_styles2 = [style_header_cell, style_header_center]
    rows2 = [
        [P('API Route Tanimlari'), P('412', style_cell_center)],
        [P('Veritabani Tablolari'), P('90 (11 schema)', style_cell_center)],
        [P('DB Indexler'), P('346', style_cell_center)],
        [P('FK Constraints'), P('125', style_cell_center)],
        [P('RLS Policy (Multi-tenant)'), P('40', style_cell_center)],
        [P('Frontend Sayfalari'), P('71', style_cell_center)],
        [P('UI Bilesenleri'), P('12', style_cell_center)],
        [P('Backend Servisleri'), P('45', style_cell_center)],
        [P('Middleware Katmanlari'), P('10', style_cell_center)],
        [P('Editor Modulleri (Fabric.js v7)'), P('33', style_cell_center)],
        [P('Desteklenen Diller'), P('8', style_cell_center)],
        [P('Cihaz Adapter Tipleri (DAL)'), P('5', style_cell_center)],
        [P('Harici Entegrasyonlar'), P('6', style_cell_center)],
    ]
    story.append(make_table(headers2, rows2, [W * 0.65, W * 0.35], h_styles2))
    story.append(Spacer(1, 2 * mm))
    story.append(P("Entegrasyonlar: PavoDisplay, Hanshow, TAMSOFT, HAL Kunye, Iyzico, Paynet", style_note))

    # ============================================================
    # 3. INSAN ELIYLE YAPIM SURESI
    # ============================================================
    story.append(PageBreak())
    story.append(P("3. Insan Eliyle Yapim Suresi Tahmini", style_h1))

    headers3 = ['Modul', 'Kidemli\nGelistirici', 'Ortalama\nTakim (3 kisi)']
    h_styles3 = [style_header_cell, style_header_center, style_header_center]
    cw3 = [W * 0.54, W * 0.23, W * 0.23]

    dev_rows = [
        ('Veritabani Mimarisi (90 tablo, 11 schema, RLS)', '3-4 hafta', '5-6 hafta'),
        ('Backend API (412 route, auth, RBAC, middleware)', '8-10 hafta', '14-16 hafta'),
        ('Frontend SPA (71 sayfa, SPA router, i18n)', '10-12 hafta', '18-22 hafta'),
        ('Sablon Editoru (Fabric.js v7, 33 modul)', '6-8 hafta', '12-16 hafta'),
        ('Cihaz Entegrasyonlari (ESL, MQTT, PWA, BT)', '6-8 hafta', '10-14 hafta'),
        ('ERP Entegrasyonlari (TAMSOFT, HAL)', '3-4 hafta', '5-7 hafta'),
        ('Odeme Sistemi (Iyzico, Paynet, 3D Secure)', '2-3 hafta', '4-5 hafta'),
        ('Signage Player (PWA, offline, HLS)', '3-4 hafta', '5-7 hafta'),
        ('Render Queue (kuyruk, retry, batch)', '2-3 hafta', '4-5 hafta'),
        ('Multi-tenant &amp; Lisans', '2-3 hafta', '4-5 hafta'),
        ('8 Dil Destegi (160 dosya, 8.500+ key)', '2-3 hafta', '3-4 hafta'),
        ('CSS / UI Tasarim (dark mode, responsive)', '3-4 hafta', '5-7 hafta'),
        ('DevOps (Docker, CI, migration)', '1-2 hafta', '2-3 hafta'),
        ('Demo Seed Data (8 dil x 1064 urun)', '1-2 hafta', '2-3 hafta'),
        ('Dokumantasyon (50K satir)', '2-3 hafta', '3-4 hafta'),
        ('Test &amp; Debug &amp; QA', '4-6 hafta', '8-10 hafta'),
    ]

    rows3 = []
    for mod, single, team in dev_rows:
        rows3.append([P(mod), P(single, style_cell_center), P(team, style_cell_center)])

    # Total row
    rows3.append([
        P('TOPLAM', ParagraphStyle('t', parent=style_cell_bold, textColor=PRIMARY_DARK)),
        P('57-79 hafta', ParagraphStyle('t', parent=style_cell_center, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)),
        P('102-138 hafta', ParagraphStyle('t', parent=style_cell_center, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)),
    ])

    story.append(make_table(headers3, rows3, cw3, h_styles3))

    story.append(Spacer(1, 3 * mm))

    # Duration summary box
    dur_data = [
        [P('1 kidemli gelistirici', style_cell_bold),
         P('~14-18 ay', ParagraphStyle('t', parent=style_cell_right_bold, textColor=PRIMARY_DARK))],
        [P('3 kisilik takim', style_cell_bold),
         P('~9-12 ay', ParagraphStyle('t', parent=style_cell_right_bold, textColor=PRIMARY_DARK))],
    ]
    dur_t = Table(dur_data, colWidths=[W * 0.60, W * 0.40])
    dur_t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, PRIMARY),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(dur_t)

    # ============================================================
    # 4. GELISTIRME MALIYETI
    # ============================================================
    story.append(Spacer(1, 6 * mm))
    story.append(P("4. Gelistirme Maliyeti Tahmini", style_h1))

    # --- Scenario 1: Turkey ---
    story.append(P("Senaryo 1: Turkiye Yerli Gelistirme", style_h2))

    headers4 = ['Kalem', 'Birim Fiyat', 'Sure', 'Tutar']
    h_styles4 = [style_header_cell, style_header_right, style_header_center, style_header_right]
    cw4 = [W * 0.36, W * 0.22, W * 0.16, W * 0.26]

    rows4a = [
        [P('Kidemli Full-Stack (1 kisi)'), P('120.000 TL/ay', style_cell_right), P('16 ay', style_cell_center), P('1.920.000 TL', style_cell_right_bold)],
        [P('veya 3 kisilik takim'), P('300.000 TL/ay', style_cell_right), P('10 ay', style_cell_center), P('3.000.000 TL', style_cell_right_bold)],
        [P('UI/UX Tasarimci'), P('60.000 TL/ay', style_cell_right), P('4 ay', style_cell_center), P('240.000 TL', style_cell_right)],
        [P('Proje Yonetimi'), P('80.000 TL/ay', style_cell_right), P('12 ay', style_cell_center), P('960.000 TL', style_cell_right)],
        [P('Altyapi / Test'), P('sabit', style_cell_right), P('-', style_cell_center), P('200.000 TL', style_cell_right)],
        [P('TOPLAM (yerli)', ParagraphStyle('t', parent=style_cell_bold, textColor=PRIMARY_DARK)),
         P('', style_cell_right), P('', style_cell_center),
         P('2.4M - 4.4M TL', ParagraphStyle('t', parent=style_cell_right_bold, textColor=PRIMARY_DARK))],
    ]
    story.append(make_table(headers4, rows4a, cw4, h_styles4))

    # --- Scenario 2: International ---
    story.append(Spacer(1, 4 * mm))
    story.append(P("Senaryo 2: Uluslararasi Freelance / Ajans", style_h2))

    rows4b = [
        [P('Senior Full-Stack'), P('$60-80/saat', style_cell_right), P('~2.500 saat', style_cell_center), P('$150K - $200K', style_cell_right_bold)],
        [P('veya Ajans (3-4 kisi)'), P('$15-25K/ay', style_cell_right), P('10 ay', style_cell_center), P('$150K - $250K', style_cell_right_bold)],
        [P('UI/UX'), P('$40-60/saat', style_cell_right), P('400 saat', style_cell_center), P('$16K - $24K', style_cell_right)],
        [P('TOPLAM (uluslararasi)', ParagraphStyle('t', parent=style_cell_bold, textColor=PRIMARY_DARK)),
         P('', style_cell_right), P('', style_cell_center),
         P('$170K - $280K', ParagraphStyle('t', parent=style_cell_right_bold, textColor=PRIMARY_DARK))],
    ]
    story.append(make_table(headers4, rows4b, cw4, h_styles4))

    # --- Scenario 3: Enterprise ---
    story.append(Spacer(1, 4 * mm))
    story.append(P("Senaryo 3: Kurumsal Yazilim Evi (Turkiye)", style_h2))

    rows4c = [
        [P('Teklif fiyati (tahmini)', style_cell_bold),
         P('', style_cell_right), P('', style_cell_center),
         P('4M - 7M TL', ParagraphStyle('t', parent=style_cell_right_bold, textColor=DANGER))],
    ]
    story.append(make_table(headers4, rows4c, cw4, h_styles4))

    # ============================================================
    # 5. MEVCUT DEGER & PIYASA DEGERI
    # ============================================================
    story.append(PageBreak())
    story.append(P("5. Mevcut Deger &amp; Piyasa Degeri", style_h1))

    # --- Strengths / Weaknesses ---
    story.append(P("Mevcut Durum Degerlendirmesi", style_h2))

    headers5 = ['Guclu Yanlar', 'Zayif Yanlar']
    h_styles5 = [
        ParagraphStyle('t', parent=style_header_cell, textColor=WHITE),
        ParagraphStyle('t', parent=style_header_cell, textColor=WHITE),
    ]

    strengths = [
        "216K satir calisan uygulama kodu",
        "90 tablolu olgun veritabani (RLS)",
        "6 harici entegrasyon (ERP, ESL, odeme)",
        "8 dil destegi",
        "Docker production-ready",
        "Multi-tenant + lisans sistemi hazir",
        "Nis sektor (ESL + Digital Signage)",
    ]
    weaknesses = [
        "Unit test yok",
        "Tek gelistirici bagimliligi",
        "CI/CD pipeline eksik",
        "Production musterisi bilinmiyor",
        "",
        "",
        "",
    ]

    rows5 = []
    for s, w in zip(strengths, weaknesses):
        s_text = f"<font color='#40c057'>&#x2713;</font>  {s}" if s else ""
        w_text = f"<font color='#fab005'>&#x26A0;</font>  {w}" if w else ""
        rows5.append([P(s_text), P(w_text)])

    t5 = Table(
        [[P('Guclu Yanlar', ParagraphStyle('t', parent=style_header_cell)),
          P('Zayif Yanlar', ParagraphStyle('t', parent=style_header_cell))]] + rows5,
        colWidths=[W * 0.50, W * 0.50])
    t5.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), HexColor('#2b8a3e')),
        ('BACKGROUND', (1, 0), (1, 0), HexColor('#e67700')),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_200),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    for i in range(1, len(rows5) + 1):
        if i % 2 == 0:
            t5.setStyle(TableStyle([('BACKGROUND', (0, i), (-1, i), GRAY_50)]))
    story.append(t5)

    # --- Market Comparison ---
    story.append(Spacer(1, 5 * mm))
    story.append(P("Piyasa Karsilastirmasi", style_h2))

    headers6 = ['Rakip / Benzer', 'Tip', 'Fiyatlandirma']
    h_styles6 = [style_header_cell, style_header_cell, style_header_right]
    cw6 = [W * 0.35, W * 0.30, W * 0.35]
    rows6 = [
        [P('Pricer / SES-imagotag', style_cell_bold), P('Enterprise ESL'), P('$500K - $2M+ kurulum', style_cell_right)],
        [P('SOLUM / Hanshow', style_cell_bold), P('Enterprise ESL yazilim'), P('Cihaz basi lisans', style_cell_right)],
        [P('Yodeck / ScreenCloud', style_cell_bold), P('Digital Signage SaaS'), P('$8-30/ekran/ay', style_cell_right)],
        [P('SoluM AIMS', style_cell_bold), P('ESL Yonetim'), P('Ozel fiyat', style_cell_right)],
    ]
    story.append(make_table(headers6, rows6, cw6, h_styles6))

    # --- Valuation ---
    story.append(Spacer(1, 5 * mm))
    story.append(P("Deger Tahmini", style_h2))

    headers7 = ['Degerleme Metodu', 'Tutar']
    h_styles7 = [style_header_cell, style_header_right]
    cw7 = [W * 0.60, W * 0.40]
    rows7 = [
        [P('Gelistirme Maliyeti Bazli (replacement cost)'), P('3M - 5M TL', style_cell_right_bold)],
        [P('SaaS Potansiyeli (100 musteri x 5.000 TL/ay x 12 ay x 5x carpan)'), P('30.000.000 TL', style_cell_right_bold)],
        [P('Lisans Satis Modeli (50 kurumsal x 100.000 TL)'), P('5.000.000 TL', style_cell_right_bold)],
        [P('IP / Kaynak Kod Satisi'), P('1.5M - 3M TL', style_cell_right_bold)],
    ]
    story.append(make_table(headers7, rows7, cw7, h_styles7))

    # --- Final Summary Box ---
    story.append(Spacer(1, 6 * mm))
    story.append(P("Nihai Degerlendirme", style_h2))

    headers8 = ['', 'Deger']
    h_styles8 = [style_header_cell, style_header_right]
    cw8 = [W * 0.60, W * 0.40]

    val_style_blue = ParagraphStyle('t', parent=style_cell_right_bold, textColor=PRIMARY_DARK, fontSize=11)
    val_style_green = ParagraphStyle('t', parent=style_cell_right_bold, textColor=SUCCESS, fontSize=11)
    val_style_red = ParagraphStyle('t', parent=style_cell_right_bold, textColor=DANGER, fontSize=11)

    rows8 = [
        [P('Replacement Cost (sifirdan yapmak)', style_cell_bold), P('3M - 5M TL', val_style_blue)],
        [P('Mevcut Varlik Degeri (kodsuz, musterisiz)', style_cell_bold), P('1.5M - 3M TL', val_style_red)],
        [P('SaaS olarak potansiyel (100+ musteri)', style_cell_bold), P('20M - 40M TL', val_style_green)],
        [P('Uluslararasi pazar potansiyeli', style_cell_bold), P('$500K - $2M', val_style_blue)],
    ]

    t8 = Table(
        [[P('', style_header_cell), P('Deger', style_header_right)]] + rows8,
        colWidths=cw8)
    t8.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_200),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 1), (-1, 1), PRIMARY_LIGHT),
        ('BACKGROUND', (0, 3), (-1, 3), SUCCESS_LIGHT),
    ]))
    story.append(t8)

    # --- Footer ---
    story.append(Spacer(1, 10 * mm))
    story.append(section_divider())
    story.append(Spacer(1, 3 * mm))
    story.append(P(
        f"Bu rapor Claude AI tarafindan {datetime.now().strftime('%d.%m.%Y %H:%M')} tarihinde "
        f"otomatik olarak olusturulmustur. Kod tabani analizi, "
        f"mimari karmasiklik degerlendirmesi ve piyasa karsilastirmasi sonuclarina dayanmaktadir.",
        style_small))
    story.append(P(
        "Omnex Display Hub  |  ESL &amp; Digital Signage Platform  |  v2.0.24",
        ParagraphStyle('t', parent=style_small, alignment=TA_CENTER, textColor=PRIMARY)))

    # Build
    doc.build(story)
    print(f"PDF olusturuldu: {OUTPUT_FILE}")
    print(f"Boyut: {os.path.getsize(OUTPUT_FILE) / 1024:.1f} KB")


if __name__ == '__main__':
    build_pdf()
