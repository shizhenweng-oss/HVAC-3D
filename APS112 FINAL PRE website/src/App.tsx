import { useEffect, useRef, useState } from 'react';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';

export default function App() {
  const vtkContainerRef = useRef<HTMLDivElement>(null);
  const vtkContext = useRef<any>(null);
  const [scalarArrays, setScalarArrays] = useState<string[]>([]);
  const [selectedScalar, setSelectedScalar] = useState<string>('');
  const [scalarRange, setScalarRange] = useState<[number, number]>([0, 1]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    try {
    if (!vtkContainerRef.current) return;

    const genericRenderWindow = vtkGenericRenderWindow.newInstance({
      background: [0.15, 0.15, 0.15],
    });
    genericRenderWindow.setContainer(vtkContainerRef.current);

    const renderer = genericRenderWindow.getRenderer();
    const renderWindow = genericRenderWindow.getRenderWindow();
    
    // Explicitly set trackball camera behavior for robust interaction
    const interactor = renderWindow.getInteractor();
    interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());

    const reader = vtkXMLPolyDataReader.newInstance();
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();

    const ctfun = vtkColorTransferFunction.newInstance();
    // We will dynamically populate RGB points based on the selected array's range

    mapper.setInputConnection(reader.getOutputPort());
    mapper.setLookupTable(ctfun);
    mapper.setUseLookupTableScalarRange(true);
    actor.setMapper(mapper);
    
    // Set opacity to 0.5 so interior fields are visible if it's an enclosed block!
    actor.getProperty().setOpacity(0.5);
    
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

      const camera = renderer.getActiveCamera();
      renderer.resetCamera();
      camera.zoom(0.8); // Zoom out a bit so the whole body is easier to see
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
    } catch (e: any) {
       console.error("VTK Init Error", e);
       setErrorMsg(e.toString());
    }
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
      setScalarRange([range[0], range[1]]);
      
      // Explicitly activate the array for coloring
      pointData.setActiveScalars(selectedScalar);
      mapper.setScalarModeToUsePointData();
      mapper.setColorByArrayName(selectedScalar);
      
      ctfun.removeAllPoints();
      // SimScale-like Rainbow: Blue -> Cyan -> Green -> Yellow -> Red
      ctfun.addRGBPoint(range[0], 0.0, 0.0, 1.0);
      ctfun.addRGBPoint(range[0] + (range[1]-range[0])*0.25, 0.0, 1.0, 1.0);
      ctfun.addRGBPoint(range[0] + (range[1]-range[0])*0.50, 0.0, 1.0, 0.0);
      ctfun.addRGBPoint(range[0] + (range[1]-range[0])*0.75, 1.0, 1.0, 0.0);
      ctfun.addRGBPoint(range[1], 1.0, 0.0, 0.0);
      
      ctfun.setMappingRange(range[0], range[1]);
      mapper.setScalarRange(range[0], range[1]);
      mapper.setScalarVisibility(true);
      
      // Force a camera reset when changing scalar just to ensure it's in view
      const renderer = renderWindow.getRenderers()[0];
      const camera = renderer.getActiveCamera();
      renderer.resetCamera();
      camera.zoom(0.8);
      
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
        <div className="controls-hint">
          Left-Click: Rotate &nbsp;|&nbsp; Shift + Left-Click: Pan &nbsp;|&nbsp; Scroll: Zoom
        </div>
      </header>
      {errorMsg && <div style={{padding: '20px', color:'red'}}>{errorMsg}</div>}
      <div ref={vtkContainerRef} className="vtk-container">
        {selectedScalar && (
          <div className="scalar-legend">
            <span className="legend-val">{scalarRange[1].toFixed(2)}</span>
            <div className="legend-bar"></div>
            <span className="legend-val">{scalarRange[0].toFixed(2)}</span>
            <div className="legend-title">{selectedScalar}</div>
          </div>
        )}
      </div>
    </div>
  );
}
