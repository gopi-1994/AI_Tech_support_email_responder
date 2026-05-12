import zipfile
import xml.etree.ElementTree as ET
import glob
import os

docs_dir = r"f:\d_drive\Personal\2nd\Project\docs"
for filepath in glob.glob(os.path.join(docs_dir, "*.docx")):
    print(f"\n======================\n--- {os.path.basename(filepath)} ---\n======================\n")
    try:
        with zipfile.ZipFile(filepath) as zf:
            xml_content = zf.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                texts = [node.text for node in p.findall('.//w:t', namespaces) if node.text]
                if texts:
                    print("".join(texts))
    except Exception as e:
        print("Error reading:", e)
