import Lenis from 'lenis'
import gsap from 'gsap'
import { CustomEase } from 'gsap/all'
import * as THREE from 'three'

import { resizeThreeCanvas, calcFov, debounce, lerp } from './utils'

import baseVertex from '../shader/baseVertex.glsl'
import baseFragment from '../shader/baseFragment.glsl'
import effectVertex from '../shader/effectVertex.glsl'
import effectFragment from '../shader/effectFragment.glsl'

gsap.registerPlugin(CustomEase)

// smooth scroll (lenis)
let scroll = {
  scrollY: window.scrollY,
  scrollVelocity: 0
}

const lenis = new Lenis()

lenis.on('scroll', (e) => {
  scroll.scrollY = window.scrollY
  scroll.scrollVelocity = e.velocity
})

function scrollRaf(time) {
  lenis.raf(time)
  requestAnimationFrame(scrollRaf)
}

requestAnimationFrame(scrollRaf)

// cursor position
let cursorPos = {
  current: { x: 0.5, y: 0.5 },
  target: { x: 0.5, y: 0.5 }
}

let cursorRaf

const lerpCursorPos = () => {
  const x = lerp(cursorPos.current.x, cursorPos.target.x, 0.05)
  const y = lerp(cursorPos.current.y, cursorPos.target.y, 0.05)

  cursorPos.current.x = x
  cursorPos.current.y = y

  const delta = Math.sqrt(
    ((cursorPos.target.x - cursorPos.current.x) ** 2) +
    ((cursorPos.target.y - cursorPos.current.y) ** 2)
  )

  if (delta < 0.001 && cursorRaf) {
    cancelAnimationFrame(cursorRaf)
    cursorRaf = null
    return
  }

  cursorRaf = requestAnimationFrame(lerpCursorPos)
}

window.addEventListener('mousemove', (event) => {
  cursorPos.target.x = (event.clientX / window.innerWidth)
  cursorPos.target.y = (event.clientY / window.innerHeight)

  if (!cursorRaf) {
    cursorRaf = requestAnimationFrame(lerpCursorPos)
  }
})

// helper for image-to-webgl and uniform updates
// this lerps when entering the texture with cursor
const handleMouseEnter = (index) => {
  gsap.to(
    mediaStore[index],
    { mouseEnter: 1, duration: 0.6, ease: CustomEase.create('custom', '0.4, 0, 0.2, 1') }
  )
}

// this updates the cursor position uniform on the texture
const handleMousePos = (e, index) => {
  const bounds = mediaStore[index].media.getBoundingClientRect()
  const x = e.offsetX / bounds.width
  const y = e.offsetY / bounds.height

  mediaStore[index].mouseOverPos.target.x = x
  mediaStore[index].mouseOverPos.target.y = y
}

// this lerps when leaving the texture with cursor
const handleMouseLeave = (index) => {
  gsap.to(
    mediaStore[index],
    { mouseEnter: 0, duration: 0.6, ease: CustomEase.create('custom', '0.4, 0, 0.2, 1') }
  )
  gsap.to(
    mediaStore[index].mouseOverPos.target,
    { x: 0.5, y: 0.5, duration: 0.6, ease: CustomEase.create('custom', '0.4, 0, 0.2, 1') }
  )
}

// this gets all image html tags and creates a mesh for each
const setMediaStore = (scrollY) => {
  const media = [...document.querySelectorAll('[data-webgl-media]')]

  mediaStore = media.map((media, i) => {
    observer.observe(media)

    media.dataset.index = String(i)
    media.addEventListener('mouseenter', () => handleMouseEnter(i))
    media.addEventListener('mousemove', e => handleMousePos(e, i))
    media.addEventListener('mouseleave', () => handleMouseLeave(i))

    const bounds = media.getBoundingClientRect()
    const imageMaterial = material.clone()

    const imageMesh = new THREE.Mesh(geometry, imageMaterial)

    let texture = null

    texture = new THREE.Texture(media)
    texture.needsUpdate = true

    imageMaterial.uniforms.uTexture.value = texture
    imageMaterial.uniforms.uTextureSize.value.x = media.naturalWidth
    imageMaterial.uniforms.uTextureSize.value.y = media.naturalHeight
    imageMaterial.uniforms.uQuadSize.value.x = bounds.width
    imageMaterial.uniforms.uQuadSize.value.y = bounds.height
    imageMaterial.uniforms.uBorderRadius.value = getComputedStyle(media).borderRadius.replace('px', '')

    imageMesh.scale.set(bounds.width, bounds.height, 1)

    if (!(bounds.top >= 0 && bounds.top <= window.innerHeight)) {
      imageMesh.position.y = 2 * window.innerHeight
    }

    scene.add(imageMesh)

    return {
      media,
      material: imageMaterial,
      mesh: imageMesh,
      width: bounds.width,
      height: bounds.height,
      top: bounds.top + scrollY,
      left: bounds.left,
      isInView: bounds.top >= -500 && bounds.top <= window.innerHeight + 500,
      mouseEnter: 0,
      mouseOverPos: {
        current: {
          x: 0.5,
          y: 0.5
        },
        target: {
          x: 0.5,
          y: 0.5
        }
      }
    }
  })
}

// this sets the position of the mesh based on the scroll position
const setPositions = () => {
  mediaStore.forEach((object) => {
    if (object.isInView) {
      object.mesh.position.x = object.left - window.innerWidth / 2 + object.width / 2
      object.mesh.position.y = -object.top + window.innerHeight / 2 - object.height / 2 + scroll.scrollY
    }
  })
}

// shader
const CAMERA_POS = 500

const canvas = document.querySelector('canvas')

let observer
let mediaStore
let scene
let geometry
let material

// create intersection observer to only render in view elements
observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const index = entry.target.dataset.index

      if (index) {
        mediaStore[parseInt(index)].isInView = entry.isIntersecting
      }
    })
  },
  { rootMargin: '500px 0px 500px 0px' }
)

// scene
scene = new THREE.Scene()

// camera
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 10, 1000)
camera.position.z = CAMERA_POS
camera.fov = calcFov(CAMERA_POS)
camera.updateProjectionMatrix()

// geometry and material
geometry = new THREE.PlaneGeometry(1, 1, 100, 100)
material = new THREE.ShaderMaterial({
  uniforms: {
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uTime: { value: 0 },
    uCursor: { value: new THREE.Vector2(0.5, 0.5) },
    uScrollVelocity: { value: 0 },
    uTexture: { value: null },
    uTextureSize: { value: new THREE.Vector2(100, 100) },
    uQuadSize: { value: new THREE.Vector2(100, 100) },
    uBorderRadius: { value: 0 },
    uMouseEnter: { value: 0 },
    uMouseOverPos: { value: new THREE.Vector2(0.5, 0.5) }
  },
  vertexShader: effectVertex,
  fragmentShader: effectFragment,
  glslVersion: THREE.GLSL3
})

// renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// render loop
const render = (time = 0) => {
  time /= 1000

  mediaStore.forEach((object) => {
    if (object.isInView) {
      object.mouseOverPos.current.x = lerp(object.mouseOverPos.current.x, object.mouseOverPos.target.x, 0.05)
      object.mouseOverPos.current.y = lerp(object.mouseOverPos.current.y, object.mouseOverPos.target.y, 0.05)

      object.material.uniforms.uResolution.value.x = window.innerWidth
      object.material.uniforms.uResolution.value.y = window.innerHeight
      object.material.uniforms.uTime.value = time
      object.material.uniforms.uCursor.value.x = cursorPos.current.x
      object.material.uniforms.uCursor.value.y = cursorPos.current.y
      object.material.uniforms.uScrollVelocity.value = scroll.scrollVelocity
      object.material.uniforms.uMouseOverPos.value.x = object.mouseOverPos.current.x
      object.material.uniforms.uMouseOverPos.value.y = object.mouseOverPos.current.y
      object.material.uniforms.uMouseEnter.value = object.mouseEnter
    } else {
      object.mesh.position.y = 2 * window.innerHeight
    }
  })

  setPositions()

  renderer.render(scene, camera)

  requestAnimationFrame(render)
}

window.addEventListener('resize', debounce(() => {
  const fov = calcFov(CAMERA_POS)

  resizeThreeCanvas({ camera, fov, renderer })

  mediaStore.forEach((object) => {
    const bounds = object.media.getBoundingClientRect()
    object.mesh.scale.set(bounds.width, bounds.height, 1)
    object.width = bounds.width
    object.height = bounds.height
    object.top = bounds.top + scroll.scrollY
    object.left = bounds.left
    object.isInView = bounds.top >= 0 && bounds.top <= window.innerHeight,
    object.material.uniforms.uTextureSize.value.x = object.media.naturalWidth
    object.material.uniforms.uTextureSize.value.y = object.media.naturalHeight
    object.material.uniforms.uQuadSize.value.x = bounds.width
    object.material.uniforms.uQuadSize.value.y = bounds.height
    object.material.uniforms.uBorderRadius.value = getComputedStyle(object.media).borderRadius.replace('px', '')
  })
}))

// Add the preloader logic
window.addEventListener('load', () => {
  // media details
  setMediaStore(scroll.scrollY)

  requestAnimationFrame(render)

  document.body.classList.remove('loading')
})
