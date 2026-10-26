import importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from lxml import html

SCRIPT=Path(__file__).resolve().parents[1]/'export_site.py'
spec=importlib.util.spec_from_file_location('export_site',SCRIPT)
export=importlib.util.module_from_spec(spec);spec.loader.exec_module(export)
REGISTRY=json.loads((SCRIPT.parent/'template/content-schema.json').read_text(encoding='utf-8'))

class ExportTests(unittest.TestCase):
    def snapshot(self, scope, data):
        return {'format':'oaq-shared-content-v1','pages':[{'scope':scope,'revision':1,'data':data}]}

    def test_untrusted_text_is_escaped_and_only_selected_text_changes(self):
        source='<html><head></head><body><h1><span data-cms-text="index:title">old</span></h1><p>Keep me</p></body></html>'
        out=export.render_page(source,{'index':{'title':'<script>alert(1)</script>'}},{},'oaq-v57')
        d=html.fromstring(out)
        self.assertEqual(d.find('.//h1/span').text,'<script>alert(1)</script>')
        self.assertFalse(d.xpath('//script'))
        self.assertEqual(d.find('.//p').text,'Keep me')

    def test_image_replacement_preserves_title_and_removes_original_attribution(self):
        source='<html><head></head><body><section data-cms-image="index:photo"><img data-cms-pixel="true" src="old.jpg"><h1>Keep title</h1><div class="reference-credit"><a href="old">Old photographer</a></div></section></body></html>'
        val={'src':'/api/media/test','alt':'New alt','credit':'OAQ','fit':'contain','position':'top'}
        d=html.fromstring(export.render_page(source,{'index':{'photo':val}},{val['src']:'../assets/shared/file.png'},'oaq-v57'))
        self.assertEqual(d.find('.//h1').text,'Keep title')
        self.assertEqual(d.find('.//img').get('src'),'../assets/shared/file.png')
        self.assertEqual(d.find('.//img').get('alt'),'New alt')
        self.assertIn('object-fit:contain',d.find('.//img').get('style'))
        self.assertNotIn('Old photographer',d.text_content())
        self.assertIn('OAQ',d.text_content())

    def test_placeholder_gets_an_image_without_losing_layout(self):
        source='<html><head></head><body><div class="portrait" data-cms-placeholder="true" data-cms-image="people:photo"><small>Photo pending</small></div></body></html>'
        val={'src':'https://example.com/a.png','alt':'Portrait','credit':'','fit':'cover','position':'center'}
        d=html.fromstring(export.render_page(source,{'people':{'photo':val}},{val['src']:'../assets/shared/a.png'},'oaq-v57'))
        self.assertIn('portrait',d.find('.//div').get('class'))
        self.assertEqual(len(d.xpath('//img')),1)
        self.assertTrue(d.xpath('//*[@data-cms-placeholder]'))

    def test_existing_image_layout_option_retains_stylesheet_fit(self):
        source='<html><head></head><body><img data-cms-image="global:logo" src="old.png" style="object-fit:contain;opacity:.8"></body></html>'
        value={'src':'https://example.com/logo.png','alt':'OAQ','credit':'','fit':'','position':'center'}
        doc=html.fromstring(export.render_page(source,{'global':{'logo':value}},{value['src']:'../assets/shared/logo.png'},'oaq-v57'))
        style=doc.find('.//img').get('style')
        self.assertNotIn('object-fit',style);self.assertIn('opacity:.8',style)

    def test_shared_menu_changes_reach_every_page(self):
        source='<html><head></head><body><a data-cms-text="global:menu">Old</a></body></html>'
        for _ in range(2): self.assertIn('New menu',export.render_page(source,{'global':{'menu':'New menu'}},{},'oaq-v57'))

    def test_editor_is_removed_from_static_output(self):
        source='<html><head><link href="/editor/editor.css" rel="stylesheet"></head><body><script id="cms-config">{}</script><script src="/editor/editor.js"></script></body></html>'
        output=export.render_page(source,{}, {},'oaq-v57')
        self.assertNotIn('/editor/',output);self.assertNotIn('cms-config',output)

    def test_reject_unknown_field_and_duplicate_scope(self):
        with self.assertRaises(ValueError): export.validate_snapshot(self.snapshot('global',{'unknown':'x'}),REGISTRY)
        doc=self.snapshot('global',{});doc['pages']*=2
        with self.assertRaises(ValueError): export.validate_snapshot(doc,REGISTRY)

    def test_image_validation_blocks_executable_and_network_paths(self):
        for url in ['javascript:alert(1)','//evil.test/a.jpg','file:///etc/passwd','/api/admin']:
            value={'src':url,'alt':'','credit':'','fit':'cover','position':'center'}
            with self.assertRaises(ValueError): export.validate_snapshot(self.snapshot('global',{'brand-logo':value}),REGISTRY)

    def test_news_no_script_injection_or_write_controls(self):
        source=(SCRIPT.parent/'template/en/news.html').read_text(encoding='utf-8')
        post={'id':'real-post','category':'Publications','title':'Published title','summary':'Research summary','body':'<script>bad()</script>','authors':'OAQ','url':'https://example.com/paper'}
        d=html.fromstring(export.render_page(source,{'news-posts':{'posts':[post]}},{},'oaq-v57'))
        self.assertIn('Published title',d.text_content())
        self.assertIn('<script>bad()</script>',d.text_content())
        self.assertFalse(d.xpath('//*[@id="new-post" or @id="post-editor"]'))
        self.assertFalse(d.xpath('//script[not(@src)]'))
        self.assertEqual(len(d.xpath('//article[@data-news-category]')),1)

    def test_version_number_preserves_all_older_versions(self):
        with tempfile.TemporaryDirectory(dir=SCRIPT.parent,prefix='test-') as folder:
            p=Path(folder);(p/'oaq-v54').mkdir();(p/'oaq-v55').mkdir()
            self.assertEqual(export.version_number(p),57)
            (p/'oaq-v57').mkdir();self.assertEqual(export.version_number(p),58)
            for invalid in ['../v58','57; echo bad','-1','55','1.2']:
                with self.assertRaises(ValueError): export.version_number(p,invalid)

    def test_images_must_have_safe_magic_bytes(self):
        self.assertEqual(export.image_ext(b'\x89PNG\r\n\x1a\n1234'),'.png')
        with self.assertRaises(ValueError): export.image_ext(b'<svg onload="evil()">')

    def test_private_addresses_and_credentials_are_rejected(self):
        with patch('socket.getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]):
            with self.assertRaises(ValueError): export.public_url('https://internal.example/a.png')
        with self.assertRaises(ValueError): export.public_url('https://user:pass@example.com/a.png')

    def test_all_templates_render_without_runtime_editor(self):
        for path in (SCRIPT.parent/'template/en').glob('*.html'):
            rendered=export.render_page(path.read_text(encoding='utf-8'),{}, {},'oaq-v57')
            self.assertNotIn('cms-config',rendered,path.name)
            self.assertNotIn('/editor/editor.js',rendered,path.name)

if __name__=='__main__': unittest.main()
