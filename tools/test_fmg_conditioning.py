import json
from pathlib import Path
import tempfile
import unittest
import numpy as np
from fmg_conditioning import prepare, validate

class ConditioningTests(unittest.TestCase):
    def fixture(self, spherical=True):
        return {'info': {'width':360,'height':180,'mapName':'Test'},
            'settings': {'heightExponent':2}, 'mapCoordinates':{'lonW':-180,'lonE':180,'latN':90,'latS':-90},
            'grid': {'points':[[180,90]], 'cells':[{'h':35,'temp':12,'prec':50}], 'tectonics':{'version':2 if spherical else 1}},
            'pack':{'cells':[{'p':[180,90], 'biome':13}], 'biomes':[{'i':13,'alien':'glacial'}]}}
    def sample(self, data, lat=0, lon=0):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'map.json';path.write_text(json.dumps(data))
            return prepare(path,lat,lon)
    def test_spherical_units_and_alien_variability(self):
        fields, metadata = self.sample(self.fixture())
        for field, expected in zip(fields,[1500,12,1000,1000,30]):
            self.assertEqual(field.shape,(129,129))
            np.testing.assert_array_equal(field,expected)
        self.assertEqual(metadata['source'],'FMG Full JSON')
    def test_ordinary_fmg_units_are_distinct(self):
        fields,_ = self.sample(self.fixture(False))
        self.assertEqual(fields[0][64,64],289)
        self.assertEqual(fields[3][64,64],5000)
    def test_seam_and_high_latitude_remain_finite(self):
        for lat,lon in [(0,180),(0,-180),(85,0),(-85,0)]:
            fields,_ = self.sample(self.fixture(),lat,lon)
            self.assertTrue(all(np.isfinite(f).all() for f in fields))
    def test_rejects_incomplete_map_and_outside_region(self):
        with self.assertRaises(ValueError):validate({'format':'spacology-terrain-conditioning'})
        data=self.fixture();data['mapCoordinates']={'lonW':-5,'lonE':5,'latS':-5,'latN':5}
        with self.assertRaisesRegex(ValueError,'surrounding map coverage'):self.sample(data)
    def test_snapshot_identity_and_location_provenance(self):
        a=self.sample(self.fixture())[1];b=self.sample(self.fixture(),1,2)[1]
        self.assertEqual(a['sourceHash'],b['sourceHash'])
        self.assertNotEqual(a['tileId'],b['tileId'])

if __name__=='__main__':unittest.main()
