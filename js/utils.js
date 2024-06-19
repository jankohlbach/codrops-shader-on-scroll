import { PerspectiveCamera } from 'three'

export const resizeThreeCanvas = ({
  camera,
  fov = null,
  renderer,
  effectComposer = null
}) => {
  if (camera instanceof PerspectiveCamera) {
    camera.aspect = window.innerWidth / window.innerHeight

    if (fov) {
      camera.fov = fov
    }
  }

  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  if (effectComposer) {
    effectComposer.setSize(window.innerWidth, window.innerHeight)
  }
}

export const calcFov = (CAMERA_POS) => 2 * Math.atan((window.innerHeight / 2) / CAMERA_POS) * 180 / Math.PI

export const debounce = (func, timeout = 300) => {
  let timer

  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => { func.apply(this, args) }, timeout)
  }
}

export const lerp = (start, end, damping) => start * (1 - damping) + end * damping
