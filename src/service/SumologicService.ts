import stringify from "fast-safe-stringify";
import ISumologicRequestConfig from "../interface/config/ISumologicRequestConfig";
import ISumologicServiceConfig from "../interface/config/ISumologicServiceConfig";
import ILog from "../interface/ILog";
import IService from "./../interface/IService";
import http from "./../util/http";

export default class SumologicService implements IService {
    private serviceConfig: ISumologicRequestConfig;
    private defaultLogConfig: any;

    constructor(config: ISumologicServiceConfig) {
        this.serviceConfig = config.serviceConfig;
        this.defaultLogConfig = config.defaultLogConfig || {};
    }

    // todo Is an additional config needed for initialization?
    // todo When should it be called?
    public initialize(config: any): Promise<any> {
        return Promise.resolve();
    }

    public sendAllLogs(logs: ILog[]): Promise<Response> {
        return this.preparePayload(logs)
            .then(payload => {
                if (this.serviceConfig.retryAttempts && this.serviceConfig.retryAttempts > 0) {
                    return http.postRequest(this.serviceConfig, payload)
                        .catch(() => this.retry(
                            this.serviceConfig.retryAttempts,
                            this.serviceConfig.retryInterval,
                            http.postRequest.bind(this, this.serviceConfig, payload)
                        ));
                } else {
                    return http.postRequest(this.serviceConfig, payload);
                }
            });
    }

    public preparePayload(logs: ILog[]): Promise<string> {
        const resultList = logs.map(log => {
            const preparedLog = Object.assign({}, this.defaultLogConfig, log);
            return this.tryJSONStringify(preparedLog) || stringify(preparedLog);
        });
        return Promise.resolve(resultList.join("\n"));
    }

    public destroy(): void {
        this.serviceConfig = null;
        this.defaultLogConfig = null;
    }

    public retry(retries: number, delay = 0, fn: () => Promise<Response>): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            setTimeout(() => fn().then(resolve).catch(reject), delay);
        })
        .catch(error => retries > 1 ? this.retry(retries - 1, delay, fn) : Promise.reject(error));
    }

    /**
     * It is necessary to convert objects safely, otherwise we can lost the whole log bundle
     */
    private tryJSONStringify(obj: any): string {
        try {
            return JSON.stringify(obj);
        } catch (_) {
            //ignore the error
            return "";
        }
    }
}
