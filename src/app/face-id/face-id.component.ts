import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-face-id',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './face-id.component.html',
  styleUrl: './face-id.component.scss'
})
export class FaceIdComponent {
  
  @ViewChild('imageElement') imageElement!: ElementRef;
  @ViewChild('canvasElement') canvasElement!: ElementRef;

  imageSrc: string | ArrayBuffer | null = null;
  private labeledFaceDescriptors: faceapi.LabeledFaceDescriptors[] = [];
  detectedName: string | null = null;
  matchConfidence: number | null = null;
  isModelLoaded = false;

  // Labels of known individuals
  private labels = ['lennard', 'raj', 'sheldon']; // Update this with actual labels as needed

  async ngOnInit() {
    try {
      await this.loadFaceApiModels();
      await this.loadLabeledImages();
      this.isModelLoaded = true;
    } catch (error) {
      console.error('Error loading models or images:', error);
    }
  }

  async loadFaceApiModels() {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models');
    } catch (error) {
      console.error('Error loading face recognition models:', error);
    }
  }

  async loadLabeledImages() {
    // Loop through each label and load associated images
    for (const label of this.labels) {
      const descriptions: Float32Array[] = [];
      for (let i = 1; i <= 22; i++) { // Adjust based on the number of images per label
        try {
          // Dynamically load images from the assets folder based on label and index
          const imgUrl = `/assets/faces/${label}_${i}.png`;
          const img = await faceapi.fetchImage(imgUrl);
          const detection = await faceapi.detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (detection) {
            descriptions.push(detection.descriptor);
          } else {
            console.warn(`No face detected in image ${i} for ${label}`);
          }
        } catch (error) {
          console.warn(`Error processing image ${i} for ${label}:`, error);
        }
      }
      if (descriptions.length > 0) {
        this.labeledFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(label, descriptions));
      } else {
        console.warn(`No valid face descriptions found for ${label}`);
      }
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imageSrc = e.target?.result as string | ArrayBuffer | null;
        setTimeout(() => this.detectFaces(), 100); // Wait for image to load
      };
      reader.readAsDataURL(file);
    }
  }

  async detectFaces() {
    if (!this.imageElement) return;

    const image = this.imageElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const displaySize = { width: image.width, height: image.height };
    faceapi.matchDimensions(canvas, displaySize);

    try {
      const detection = await faceapi.detectSingleFace(image)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const resizedDetection = faceapi.resizeResults(detection, displaySize);
        const faceMatcher = new faceapi.FaceMatcher(this.labeledFaceDescriptors, 0.6);
        const match = faceMatcher.findBestMatch(resizedDetection.descriptor);

        this.detectedName = match.label !== 'unknown' ? match.label : 'Unknown Person';
        this.matchConfidence = (1 - match.distance) * 100;

        // Draw face box
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        const box = resizedDetection.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, { label: this.detectedName });
        drawBox.draw(canvas);
      } else {
        console.log('No face detected');
        this.detectedName = null;
        this.matchConfidence = null;
      }
    } catch (error) {
      console.error('Error detecting face:', error);
    }
  }

}
