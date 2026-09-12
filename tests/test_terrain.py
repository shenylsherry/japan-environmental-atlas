import pathlib,sys,unittest,numpy as np
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'/'terrain'))
from core import derive_grid
from process import pixel,lonlat,decode
from PIL import Image
import io
class TerrainTests(unittest.TestCase):
 def test_directions(self):
  y,x=np.mgrid[:160,:160]
  for angle in range(0,360,45):
   r=np.radians(angle);a=1000+10*(-np.sin(r)*x+np.cos(r)*y)
   d=derive_grid(a,10,size=32)
   np.testing.assert_allclose(d['slope'],45,atol=1e-5)
   np.testing.assert_allclose(d['aspect'],angle,atol=1e-5)
 def test_flat_and_nodata(self):
  a=np.ones((160,160));d=derive_grid(a,10,size=32)
  self.assertTrue(np.isnan(d['aspect']).all());self.assertTrue((d['terrain']==6).all())
  a[80,80]=np.nan;d=derive_grid(a,10,size=32);self.assertTrue(np.isnan(d['slope'][16,16]));self.assertEqual(d['terrain'][16,16],0)
 def test_ridge_not_every_convex_pixel(self):
  y,x=np.mgrid[:256,:256];a=2000-.02*(x-128)**2
  d=derive_grid(a,10,size=128);self.assertEqual(d['terrain'][64,64],1);self.assertGreater(d['curvature'][64,64],0)
 def test_coordinates(self):
  for lon,lat in [(139.243,35.625),(142.85,43.67),(130.5,30.34)]:
   ll=lonlat(*pixel(lon,lat,14),14);self.assertAlmostEqual(lon,ll[0]);self.assertAlmostEqual(lat,ll[1])
 def test_png_signed_nodata(self):
  a=np.zeros((256,256,3),dtype='uint8');a[0,0]=[128,0,0];a[0,1]=[255,255,156];im=Image.fromarray(a);b=io.BytesIO();im.save(b,format='PNG');z=decode(b.getvalue());self.assertTrue(np.isnan(z[0,0]));self.assertEqual(z[0,1],-1)
if __name__=='__main__':unittest.main()
