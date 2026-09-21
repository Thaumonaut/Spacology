import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch, Mock
import hashlib
import unittest
import test_fmg_conditioning as fixtures

spec=importlib.util.spec_from_file_location('terrain_lab',Path(__file__).with_name('terrain-lab.py'))
lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)

class LabTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        lab.OUTPUT=Path(self.folder.name);lab.SOURCE=lab.OUTPUT/'source.json'
        lab.job=None;lab.active_detail=None;self.client=lab.app.test_client()
    def tearDown(self):self.folder.cleanup()
    def test_import_and_source_status(self):
        data=fixtures.ConditioningTests().fixture()
        response=self.client.post('/import',json=data,headers={'Origin':'http://127.0.0.1:5174'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'],'http://127.0.0.1:5174')
        self.assertEqual(self.client.get('/status').json['source']['name'],'Test')
        self.assertEqual(json.loads(lab.SOURCE.read_text()),data)
    def test_invalid_import_does_not_replace_existing_source(self):
        self.client.post('/import',json=fixtures.ConditioningTests().fixture())
        before=lab.SOURCE.read_bytes()
        self.assertEqual(self.client.post('/import',json={'grid':[]}).status_code,400)
        self.assertEqual(lab.SOURCE.read_bytes(),before)
    def test_run_validation_and_foreign_origin(self):
        self.assertEqual(self.client.post('/run',json={'device':'mps','mode':'fmg'}).status_code,400)
        self.assertEqual(self.client.post('/run',json={'device':'invalid'}).status_code,400)
        self.assertEqual(self.client.post('/import',json={},headers={'Origin':'https://example.com'}).status_code,403)
    def test_preflight(self):
        response=self.client.options('/import',headers={'Origin':'http://127.0.0.1:5174'})
        self.assertEqual(response.status_code,204)
        self.assertEqual(response.headers['Access-Control-Allow-Headers'],'Content-Type')
    def test_detail_job_coalescing_cache_and_source_guard(self):
        self.client.post('/import',json=fixtures.ConditioningTests().fixture())
        digest=hashlib.sha256(lab.SOURCE.read_bytes()).hexdigest()
        body=dict(world=digest,latitude=0,longitude=0)
        process=Mock();process.poll.return_value=None
        with patch.object(lab.subprocess,'Popen',return_value=process) as spawn:
            first=self.client.post('/detail',json=body).json
            self.assertEqual(first['state'],'running')
            self.assertEqual(self.client.post('/detail',json=body).json['state'],'running')
            self.assertEqual(self.client.post('/detail',json={**body,'longitude':1}).json['state'],'busy')
            self.assertEqual(spawn.call_count,1)
            folder=lab.OUTPUT/'cache'/first['key']
            (folder/'report.json').write_text(json.dumps({'inferenceSeconds':1}))
            process.poll.return_value=0
            self.assertEqual(self.client.post('/detail',json=body).json['state'],'ready')
            self.assertEqual(spawn.call_count,1)
            self.assertEqual(self.client.post('/detail',json={**body,'world':'old'}).status_code,409)
        if lab.log_file:lab.log_file.close();lab.log_file=None

if __name__=='__main__':unittest.main()
