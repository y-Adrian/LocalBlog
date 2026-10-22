---
contentType: article
showArticleMeta: true
date: 2026/10/21
---
## Prepare env

Basic information:
```bash
uname -a
Linux adrian 6.8.0-138-generic #138~22.04.1-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug  7 13:34:27 UTC  aarch64 aarch64 aarch64 GNU/Linux
```

### install conda

Here I install conda with miniforge3:
```bash
curl -L -O "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-$(uname)-$(uname -m).sh" bash Miniforge3-$(uname)-$(uname -m).sh
```

Then use conda to init env:
```bash
# create a new env with conda
conda create --name duotpu python=3.9.0

# activate the env 
conda activate duotpu

# check the current envs
conda env list

# install torch with pip, because I can't install it with conda in my arm linux
# with 
# conda install pytorch==1.12.1 torchvision==0.13.1 torchaudio==0.12.1 cpuonly -c pytorch
pip install torch==1.12.1 torchvision==0.13.1 torchaudio==0.12.1

# install numpy which is compatiable with torch
pip install "numpy==1.26.4"
```

Also there are no such libraries on my arm linux, so I need to install them:
```bash
sudo apt install -y libxcb1 libgl1 libglib2.0-0
```
### Generate `yolov5n_jit.pt`

```bash
# get yolov5-master code zip
wget -O yolov5.zip https://codeload.github.com/ultralytics/yolov5/zip/refs/heads/master

# unzip it
unzip yolov5.zip

# get yolov5n.pt
wget https://github.com/ultralytics/yolov5/releases/download/v6.2/yolov5n.pt
# move it to yolov5-master
mv yolov5n.pt yolov5-master/

# install requirements
cd yolov5-master/
pip install -r requirements.txt
```

And change file according to this [guide](https://milkv.io/zh/docs/duo/application-development/tpu/tpu-yolov5#%E7%94%9F%E6%88%90%E5%8E%9F%E5%A7%8B%E6%A8%A1%E5%9E%8B%E6%96%87%E4%BB%B6):
Find `yolov5-master/models/yolo.py`, comment out the lines from line 99 to line 115, and add `return x` at line 116.

![[assets/Pasted image 20261021114234.png|576]]


Find the file `upsampling.py` (in my case the file is at`/home/adrian/miniforge3/envs/duotpu/lib/python3.9/site-packages/torch/nn/modules/upsampling.py`). Modify the line 153: 
![[assets/Pasted image 20261021114209.png|596]]

We also need add `main.py` under `yolov5-master`:
```python
import torch
from models.experimental import attempt_download
model = torch.load(attempt_download("./yolov5n.pt"),
map_location=torch.device('cpu'))['model'].float()
model.eval()
model.model[-1].export = True
torch.jit.trace(model, torch.rand(1, 3, 640, 640), strict=False).save('./yolov5n_jit.pt')
```


Then we can run command `python main.py` in directory `yolov5-master`, then we will get `yolov5n_jit.pt`.

### prepare docker environment on Mac

Because I am using a Mac, and the official pre-compiled `tpu-mlir` is built for `x86-64`. So I only perform model conversion in docker. 
```bash
docker --version
# Docker version 29.7.2, build a7dcaa6fdb

docker pull sophgo/tpuc_dev:latest
docker run --platform linux/amd64 --privileged --name tpumlir \
  -v $PWD:/workspace -it sophgo/tpuc_dev:latest
# in container
pip install tpu_mlir

# get tpu-mlir
git clone https://github.com/milkv-duo/tpu-mlir.git
source ./tpu-mlir/envsetup.sh

mkdir yolov5n_torch && cd yolov5n_torch
cp -rf ${TPUC_ROOT}/regression/dataset/COCO2017 .  
cp -rf ${TPUC_ROOT}/regression/image .

# you should also copy the yolov5n_jit.pt file you generated before to this directory

mkdir work && cd work
```

## Model conversion

### TORCH model converted to MLIR
```bash
model_transform.py \  
--model_name yolov5n \  
--model_def ../yolov5n_jit.pt \  
--input_shapes [[1,3,640,640]] \  
--pixel_format "rgb" \  
--keep_aspect_ratio \  
--mean 0,0,0 \  
--scale 0.0039216,0.0039216,0.0039216 \  
--test_input ../image/dog.jpg \  
--test_result yolov5n_top_outputs.npz \  
--output_names 1219,1234,1249 \  
--mlir yolov5n.mlir
```

Example of successful operation:
![[assets/Pasted image 20261021162113.png|707]]

Then you will see these files:
![[assets/Pasted image 20261021162749.png|709]]

### Generate calibration tables required for quantification

Before converting to the INT8 model, you need to generate a calibration table.
```bash
run_calibration.py yolov5n.mlir \  
--dataset ../COCO2017 \  
--input_num 100 \  
-o ./yolov5n_cali_table
```

Example of successful operation:
![[assets/Pasted image 20261021163622.png|713]]

After the operation is completed, the `yolov5n_cali_table` file will be generated, which is used for subsequent compilation of the INT8 model.
![[assets/Pasted image 20261021163708.png|729]]

### MLIR quantized into INT8 asymmetric cvimodel

Convert MLIR model to INT8 model. Here I use Milk-V Duo S, so the parameter `--chip` is `cv181x`:
```bash
model_deploy.py \
 --mlir yolov5n.mlir \
 --quantize INT8 \
 --calibration_table ./yolov5n_cali_table \
 --chip cv181x \
 --test_input ../image/dog.jpg \
 --test_reference yolov5n_top_outputs.npz \
 --compare_all \
 --tolerance 0.96,0.72 \
 --fuse_preprocess \
 --debug \
 --model yolov5n_int8_fuse.cvimodel
```

Example of successful operation:
![[assets/Pasted image 20261021163919.png|679]]

Then you can find the `yolov5n_int8_fuse.cvimodel` file:
![[assets/Pasted image 20261021164015.png|696]]


## Validate on Milk-V Duo S

### Get tpu-sdk

Switch to the `/workspace` directory in the Docker terminal, and download tpu sdk:
```bash
cd /workspace

# Here I am using Milk-V Duo S
git clone https://github.com/milkv-duo/tpu-sdk-sg200x.git  
mv ./tpu-sdk-sg200x ./tpu-sdk
```

### Copy tpu-sdk and model files to Duo S

In the terminal of Duo S, create a new directory, and copy `tpu-sdk` and model files to Duo S:
```bash
# run this in Duo S
mkdir -p /mnt/tpu && cd /mnt/tpu

# run these in docker
scp -r /workspace/tpu-sdk root@192.168.42.1:/mnt/tpu/  
scp /workspace/yolov5n_torch/work/yolov5n_int8_fuse.cvimodel root@192.168.42.1:/mnt/tpu/tpu-sdk/
```

### Set environment variables

In the terminal of Duo S:
```bash
cd /mnt/tpu/tpu-sdk  
source ./envs_tpu_sdk.sh
```

### Perform object detection

On the Duo S board, perform object detection on the image:
![[assets/Pasted image 20261022144604.png|546]]

In the terminal of the Duo board, use the `yolov5n_int8_fuse.cvimodel` model for object detection:
```bash
./samples/samples_extra/bin/cvi_sample_detector_yolo_v5_fused_preprocess ./yolov5n_int8_fuse.cvimodel ./samples/samples_extra/data/dog.jpg yolov5n_out.jpg
```

Example of successful detection result:
![[assets/Pasted image 20261022144902.png|704]]

After the successful operation, the detection result file `yolov5n_out.jpg` will be generated, copy this file to your PC:
```bash
scp root@192.168.42.1:/mnt/tpu/tpu-sdk/yolov5n_out.jpg .
```

Then you will see this:
![[assets/yolov5n_out.jpg|665]]

Let's try another one. 
```bash
./samples/samples_extra/bin/cvi_sample_detector_yolo_v5_fused_preprocess ./yolov5n_int8_fuse.cvimodel ./walking_dog.jpg walking_dog_out.jpg  
```
Input (this is a picture I download from the internet):
![[assets/walking_dog.jpg|341]]
output:
![[assets/walking_dog_out.jpg|346]]

## Reference

This guide is primarily base on this [Object Detection Based on YOLOv5](https://milkv.io/docs/duo/application-development/tpu/tpu-yolov5#2-configure-docker-development-environment), and I made some adjustments based on some differences in my own develop environment.
