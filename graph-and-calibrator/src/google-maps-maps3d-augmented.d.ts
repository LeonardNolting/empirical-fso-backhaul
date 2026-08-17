declare global {
    namespace google.maps.maps3d {
        interface CameraOptions {
            center?: google.maps.LatLngAltitude | google.maps.LatLngAltitudeLiteral;
            heading?: number;
            tilt?: number;
            range?: number;
            roll?: number;
        }

        interface FlyAroundAnimationOptions {
            camera: google.maps.maps3d.CameraOptions;
            durationMillis?: number;
            repeatCount?: number;
        }

        interface FlyToAnimationOptions {
            endCamera: google.maps.maps3d.CameraOptions;
            durationMillis?: number;
        }

        interface Map3DElement {
            /**
             * This method orbits the camera around a given location for a given duration. The animation can be repeated by the given number of FlyAroundAnimationOptions.repeatCount times.
             *
             * The camera will move in a clockwise direction.
             *
             * The method is asynchronous because animations can only start after the map has loaded a minimum amount. The method returns once the animation has been started.
             *
             * If the number of FlyAroundAnimationOptions.repeatCount times is zero, no spin will occur, and the animation will complete immediately after it starts.
             * @param options
             */
            flyCameraAround(options: FlyAroundAnimationOptions): void;

            /**
             * This method moves the camera parabolically from the current location to a given end location over a given duration.
             *
             * The method is asynchronous because animations can only start after the map has loaded a minimum amount. The method returns once the animation has been started.
             * @param options
             */
            flyCameraTo(options: FlyToAnimationOptions): void;

            /**
             * This method stops any fly animation that might happen to be running. The camera stays wherever it is mid-animation; it does not teleport to the end point.
             *
             * The method is asynchronous because animations can only start or stop after the map has loaded a minimum amount. The method returns once the animation has stopped.
             */
            stopCameraAnimation(): void;
        }

        interface Marker3DElement extends HTMLElement {
            new (options?: Marker3DElementOptions): Marker3DElement;
            /**
             * Position of the marker in 3D space (latitude, longitude, optional altitude).
             */
            position?: google.maps.LatLngLiteral | google.maps.LatLngAltitude | google.maps.LatLngAltitudeLiteral;

            /**
             * Specifies how altitude is interpreted.
             */
            altitudeMode?: google.maps.maps3d.AltitudeMode;

            /**
             * How this marker participates in collision resolution.
             */
            collisionBehavior?: google.maps.CollisionBehavior;

            /**
             * Whether this marker continues to draw even when occluded by geometry.
             */
            drawsWhenOccluded?: boolean;

            /**
             * If true, extrudes a line to the ground/mesh.
             */
            extruded?: boolean;

            /**
             * Text label displayed by this marker.
             */
            label?: string;

            /**
             * Whether the marker preserves size regardless of camera distance/tilt.
             */
            sizePreserved?: boolean;

            /**
             * z-index for compare ordering with other markers.
             */
            zIndex?: number;
        }

        /**
         * Options used to construct a Marker3DElement.
         */
        interface Marker3DElementOptions {
            position?: google.maps.LatLngLiteral | google.maps.LatLngAltitude | google.maps.LatLngAltitudeLiteral;
            altitudeMode?: google.maps.maps3d.AltitudeMode;
            collisionBehavior?: google.maps.CollisionBehavior;
            drawsWhenOccluded?: boolean;
            extruded?: boolean;
            label?: string;
            sizePreserved?: boolean;
            zIndex?: number;
        }

        /**
         * Interactive 3D marker element (clickable, focusable).
         */
        interface Marker3DInteractiveElement extends Marker3DElement {
            new (
                options?: Marker3DInteractiveElementOptions
            ): Marker3DInteractiveElement;

            /**
             * If true, the marker can receive focus.
             */
            focusable?: boolean;

            /**
             * If true, the marker is clickable.
             */
            clickable?: boolean;

            /**
             * Title used for accessibility (e.g. screen readers).
             */
            title?: string;
        }

        interface Marker3DInteractiveElementOptions
            extends Marker3DElementOptions {
            focusable?: boolean;
            clickable?: boolean;
            title?: string;
        }
    }
}

export {}