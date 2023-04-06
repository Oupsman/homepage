import { useTranslation } from "next-i18next";

import Container from "components/services/widget/container";
import Block from "components/services/widget/block";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {

  function toKb(value, unit) {
    switch (unit) {
      case "K":
        return parseInt(value, 10);
      case "M":
        return parseInt(value, 10) * 1024;
      case "G":
        return parseInt(value, 10) * 1024 * 1024;
      default:
        return parseInt(value, 10);
    }
  }

  function sumMemory(meminfos) {
    let result;
    let sumused=0;
    let sumfree=0;

    const idused = ["Active", "Wired", "Laundry", "Buf"];
    const idfree = ["Inact", "Free"];
    const size = "([0-9]+)([KMG])";

    for (let id = 0; id < idused.length;id+=1 ) {
      const re = new RegExp(`${size  } ${  idused[id]  }`);
      result = re.exec(meminfos);

      if (result) {
        sumused += toKb(result[1], result[2]);
      }
    }

    for (let id = 0; id < idfree.length; id+=1 ) {
      const re = new RegExp(`${size  } ${  idfree[id]  }`);
      result = re.exec(meminfos);

      if (result) {
        sumfree += toKb(result[1], result[2]);
      }
    }

    return 100*(sumused / (sumused + sumfree));

  }


  const { t } = useTranslation();

  const { widget } = service;
  const dataStorage = `${widget.service_name}.${widget.service_group}datas`;

  const { data: activityData, error: activityError } = useWidgetAPI(widget, "activity");
  const { data: interfaceData, error: interfaceError } = useWidgetAPI(widget, "interface");

  if (activityError || interfaceError) {
    const finalError = activityError ?? interfaceError;
    return <Container error={ finalError } />;
  }

  if (!activityData || !interfaceData) {
    return (
      <Container service={service}>
        <Block label="opnsense.cpu" />
        <Block label="opnsense.memory" />
        <Block label="opnsense.wanTraffic" />
        <Block label="opnsense.wanTrafficRate" />
      </Container>
    );
  }


  const cpuIdle = activityData.headers[2].match(/ ([0-9.]+)% idle/)[1];
  const cpu = 100 - parseFloat(cpuIdle);
  const memory = sumMemory(activityData.headers[3]);

  const mode = widget.mode ? widget.mode : "total_split"
  const params = mode.split ("_")

  const rate = params[0]
  const split = params[1]

  const wan = widget.wan ? interfaceData.interfaces[widget.wan] : interfaceData.interfaces.wan;
  const wanUpload = parseFloat(wan['bytes transmitted']);
  const wanDownload = parseFloat(wan['bytes received']);

  const dataStored = localStorage.getItem(dataStorage);
  let datas;

  if (dataStored === null) {
    datas = {
      wanUpload : 0,
      wanDownload :  0,
      updateTime : 0,
      wanUploadRate : 0,
      wanDownloadRate : 0
    }
  } else {
    datas = JSON.parse(dataStored);
  }

  const wanUploadDiff = wanUpload - datas.wanUpload;
  const wanDownloadDiff = wanDownload - datas.wanDownload;


  if (wanUploadDiff > 0 || wanDownloadDiff > 0) {
    const specialTimeValue = new Date().getTime();
    const timeDif = specialTimeValue - datas.updateTime;

    datas.wanUploadRate = 8 * wanUploadDiff / (timeDif / 1000);
    datas.wanDownloadRate = 8 * wanDownloadDiff / (timeDif / 1000);
    datas.updateTime = specialTimeValue;
  }
  datas.wanUpload = wanUpload;
  datas.wanDownload = wanDownload;

  localStorage.setItem(dataStorage, JSON.stringify(datas));
  let res = ""
  if (split === "summed") {
    res = (
      <Container service={service}>
        <Block label="opnsense.cpu" value={t("common.percent", { value: cpu.toFixed(2) })}  />
        <Block label="opnsense.memory" value={t("common.percent", { value: memory})} />
        {wan && mode === "total" && <Block label="opnsense.wanTraffic" value={t("common.bytes", { value: datas.wanUpload + datas.wanDownload} )} />}
        {wan && rate === "rate" && <Block label="opnsense.wanTrafficRate" value={t("common.bitrate", { value: datas.wanUploadRate + datas.wanDownloadRate})} /> }
      </Container>
    );
  } else {
    res = (
      <Container service={service}>
        <Block label="opnsense.cpu" value={t("common.percent", { value: cpu.toFixed(2) })} />
        <Block label="opnsense.memory" value={t("common.percent", { value: memory })} />
        {wan && mode === "total" && <Block label="opnsense.wanTrafficUpload" value={t("common.bytes", { value: datas.wanUpload} )} />}
        {wan && mode === "total" && <Block label="opnsense.wanTrafficDownload" value={t("common.bytes", { value: datas.wanDownload} )} />}
        {wan && rate === "rate" && <Block label="opnsense.wanTrafficUploadRate" value={t("common.bitrate", { value: datas.wanUploadRate}  )}/>}
        {wan && rate === "rate" && <Block label="opnsense.wanTrafficDownloadRate" value={t("common.bitrate", { value: datas.wanDownloadRate})}/>}
      </Container>
    );
  }
 return res;
}
