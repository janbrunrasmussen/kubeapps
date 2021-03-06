import * as React from "react";

import { IFunction, IResource } from "../../shared/types";
import DeploymentStatus from "../DeploymentStatus";
import FunctionControls from "./FunctionControls";
import FunctionEditor from "./FunctionEditor";
import FunctionInfo from "./FunctionInfo";

interface IFunctionViewProps {
  name: string;
  namespace: string;
  function: IFunction | undefined;
  getFunction: () => Promise<void>;
  deleteFunction: () => Promise<void>;
  updateFunction: (fn: Partial<IFunction>) => Promise<void>;
}

interface IFunctionViewState {
  deployment?: IResource;
  socket?: WebSocket;
  functionCode: string;
  codeModified: boolean;
}

class FunctionView extends React.Component<IFunctionViewProps, IFunctionViewState> {
  public state: IFunctionViewState = {
    codeModified: false,
    functionCode: "",
  };

  public async componentDidMount() {
    const { getFunction } = this.props;
    getFunction();
  }

  public componentWillReceiveProps(nextProps: IFunctionViewProps) {
    if (this.state.deployment || !nextProps.function) {
      // receiving updated function after saving
      this.setState({ codeModified: false });
      return;
    }

    const f = nextProps.function;
    const apiBase = `ws://${window.location.host}/api/kube`;
    const socket = new WebSocket(
      `${apiBase}/apis/apps/v1beta1/namespaces/${
        f.metadata.namespace
      }/deployments?watch=true&labelSelector=function=${f.metadata.name}`,
    );
    socket.addEventListener("message", e => this.handleEvent(e));
    this.setState({
      functionCode: f.spec.function,
      socket,
    });
  }

  public componentWillUnmount() {
    const { socket } = this.state;
    if (socket) {
      socket.close();
    }
  }

  public handleEvent(e: MessageEvent) {
    const msg = JSON.parse(e.data);
    const deployment: IResource = msg.object;
    this.setState({ deployment });
  }

  public render() {
    const { function: f, deleteFunction } = this.props;
    const { deployment } = this.state;
    if (!f || !deployment) {
      return <div>Loading</div>;
    }
    return (
      <section className="FunctionView padding-b-big">
        <main>
          <div className="container">
            <div className="row collapse-b-tablet">
              <div className="col-3">
                <FunctionInfo function={f} />
              </div>
              <div className="col-9">
                <div className="row padding-t-bigger">
                  <div className="col-4">
                    <DeploymentStatus deployments={[deployment]} />
                  </div>
                  <div className="col-8 text-r">
                    <FunctionControls
                      enableSaveButton={this.state.codeModified}
                      updateFunction={this.handleFunctionUpdate}
                      deleteFunction={deleteFunction}
                    />
                  </div>
                </div>
                <FunctionEditor
                  runtime={f.spec.runtime}
                  value={this.state.functionCode}
                  onChange={this.handleCodeChange}
                />
              </div>
            </div>
          </div>
        </main>
      </section>
    );
  }

  private handleCodeChange = (value: string) => {
    this.setState({ functionCode: value, codeModified: true });
  };

  private handleFunctionUpdate = () => {
    const { function: f } = this.props;
    if (f) {
      this.props.updateFunction({
        ...f,
        spec: {
          ...f.spec,
          function: this.state.functionCode,
        },
      });
    }
  };
}

export default FunctionView;
