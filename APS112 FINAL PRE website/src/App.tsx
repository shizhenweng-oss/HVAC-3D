import { useEffect, useRef, useState } from 'react';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';

export default function App() {
  const vtkContainerRef = useRef<HTMLDivElement>(null);
  const vtkContext = useRef<any>(null);
  const [scalarArrays, setScalarArrays] = useState<string[]>([]);
  const [selectedScalar, setSelectedScalar] = useState<string>('');

  useEffect(() => {
    if (!vtkContainerRef.current) return;

    const genericRenderWindow = vtkGenericRenderWindow.newInstance({
      background: [0.15, 0.15, 0.15],
    });
    genericRenderWindow.setContainer(vtkContainerRef.current);

    const renderer = genericRenderWindow.getRenderer();
    const renderWindow = genericRenderWindow.getRenderWindow();

    const reader = vtkXMLPolyDataReader.newInstance();
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();

    const ctfun = vtkColorTransferFunction.newInstance();
    ctfun.addRGBPoint(0, 0.0, 0.0, 1.0);
    ctfun.addRGBPoint(0.5, 0.0, 1.0, 0.0);
    ctfun.addRGBPoint(1, 1.0, 0.0, 0.0);

    mapper.setInputConnection(reader.getOutputPort());
    mapper.setLookupTable(ctfun);
    mapper.setUseLookupTableScalarRange(true);
    actor.setMapper(mapper);
    
    renderer.addActor(actor);

    vtkContext.current = {
      genericRenderWindow,
      reader,
      mapper,
      actor,
      ctfun,
      renderWindow
    };

    const fileUrl = '/HVACzoning-Prot_V1__no_returning_vent_-Basement_with_unfinished_return_vents_-SOLUTION_FIELDS/surface.vtp';
    
    reader.setUrl(fileUrl).then(() => {
      const data = reader.getOutputData(0);
      if (!data) return;
      
      const pointData = data.getPointData();
      const numArrays = pointData.getNumberOfArrays();
      
      const arrays: string[] = [];
      for (let i = 0; i < numArrays; i++) {
        arrays.push(pointData.getArrayByIndex(i).getName());
      }
      setScalarArrays(arrays);
      
      if (arrays.length > 0) {
        setSelectedScalar(arrays[0]);
      }

      renderer.resetCamera();
      renderWindow.render();
    }).catch((err: any) => {
      console.error("Error loading VTP:", err);
    });

    const resizeObserver = new ResizeObserver(() => {
      genericRenderWindow.resize();
    });
    resizeObserver.observe(vtkContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      actor.delete();
      mapper.delete();
      reader.delete();
      genericRenderWindow.delete();
      ctfun.delete();
    };
  }, []);

  useEffect(() => {
    if (!vtkContext.current || !selectedScalar) return;
    const { reader, mapper, ctfun, renderWindow } = vtkContext.current;
    
    const data = reader.getOutputData(0);
    if (!data) return;
    
    const pointData = data.getPointData();
    const array = pointData.getArrayByName(selectedScalar);
    if (array) {
      const range = array.getRange();
      mapper.setScalarModeToUsePointFieldData();
      mapper.setColorByArrayName(selectedScalar);
      ctfun.setMappingRange(range[0], range[1]);
      mapper.setScalarRange(range[0], range[1]);
      mapper.setScalarVisibility(true);
      renderWindow.render();
    }
  }, [selectedScalar]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h2>HVAC 3D Simulation Viewer (No Upload or Gestures)</h2>
        {scalarArrays.length > 0 && (
          <div className="scalar-selector">
            <label>Simulation Metric: </label>
            <select value={selectedScalar} onChange={(e) => setSelectedScalar(e.target.value)}>
              {scalarArrays.map(arrName => (
                <option key={arrName} value={arrName}>{arrName}</option>
              ))}
            </select>
          </div>
        )}
      </header>
      <div ref={vtkContainerRef} className="vtk-container" />
    </div>
  );
}
