import torch
import time

# Check if CUDA is available
print(f"CUDA available: {torch.cuda.is_available()}")

if torch.cuda.is_available():
    # Print CUDA version
    print(f"CUDA version: {torch.version.cuda}")
    
    # Print detailed device information
    device_count = torch.cuda.device_count()
    print(f"Device count: {device_count}")
    
    for i in range(device_count):
        print(f"\nDevice {i}: {torch.cuda.get_device_name(i)}")
        print(f"  Compute capability: {torch.cuda.get_device_capability(i)}")
        print(f"  Total memory: {torch.cuda.get_device_properties(i).total_memory / 1e9:.2f} GB")
    
    # Set current device
    current_device = torch.cuda.current_device()
    print(f"\nCurrent device: {current_device} ({torch.cuda.get_device_name(current_device)})")
    
    # Test GPU performance with a simple matrix multiplication
    print("\nRunning GPU performance test...")
    
    # Create two large matrices
    size = 5000
    a = torch.randn(size, size, device="cuda")
    b = torch.randn(size, size, device="cuda")
    
    # Warm-up run
    torch.matmul(a, b)
    torch.cuda.synchronize()
    
    # Benchmark
    start_time = time.time()
    c = torch.matmul(a, b)
    torch.cuda.synchronize()
    gpu_time = time.time() - start_time
    
    print(f"GPU time for {size}x{size} matrix multiplication: {gpu_time:.4f} seconds")
    
    # Compare with CPU
    a_cpu = a.cpu()
    b_cpu = b.cpu()
    
    # Warm-up run
    torch.matmul(a_cpu, b_cpu)
    
    # Benchmark
    start_time = time.time()
    c_cpu = torch.matmul(a_cpu, b_cpu)
    cpu_time = time.time() - start_time
    
    print(f"CPU time for {size}x{size} matrix multiplication: {cpu_time:.4f} seconds")
    print(f"GPU is {cpu_time/gpu_time:.2f}x faster than CPU")
    
    # Verify results match
    diff = torch.max(torch.abs(c_cpu - c.cpu())).item()
    print(f"Maximum difference between CPU and GPU results: {diff}")
    
    print("\nGPU test completed successfully!")
else:
    print("CUDA is not available. Please check your PyTorch installation and GPU drivers.") 